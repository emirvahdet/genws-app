import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  title: string;
  body: string;
  target_type: "all" | "group" | "event";
  target_id?: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the authorization header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin via user_roles table
    const { data: userRole } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!userRole) {
      throw new Error("Unauthorized: Admin access required");
    }

    const requestBody: NotificationRequest = await req.json();
    const { title, body, target_type, target_id, data } = requestBody;

    if (!title || !body) {
      throw new Error("Title and body are required");
    }

    // Get push tokens based on target type
    let pushTokensQuery = supabaseClient
      .from("push_tokens")
      .select("token, user_id");

    if (target_type === "group" && target_id) {
      // Get users in the specific group
      const { data: groupMembers } = await supabaseClient
        .from("admin_group_members")
        .select("user_id")
        .eq("group_id", target_id);

      if (groupMembers && groupMembers.length > 0) {
        const userIds = groupMembers.map((m) => m.user_id);
        pushTokensQuery = pushTokensQuery.in("user_id", userIds);
      } else {
        // No members in group
        return new Response(
          JSON.stringify({ success: true, recipient_count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (target_type === "event" && target_id) {
      // Get users registered for the specific event
      const { data: eventRegistrations } = await supabaseClient
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", target_id)
        .eq("status", "registered");

      if (eventRegistrations && eventRegistrations.length > 0) {
        const userIds = eventRegistrations.map((r) => r.user_id);
        pushTokensQuery = pushTokensQuery.in("user_id", userIds);
      } else {
        // No registrations for event
        return new Response(
          JSON.stringify({ success: true, recipient_count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // If target_type is "all", no filter is applied

    const { data: pushTokens, error: tokensError } = await pushTokensQuery;

    if (tokensError) {
      throw tokensError;
    }

    if (!pushTokens || pushTokens.length === 0) {
      // Log the notification even if no recipients
      await supabaseClient.from("notifications_log").insert({
        title,
        body,
        target_type,
        target_id: target_id || null,
        sent_by: user.id,
        recipient_count: 0,
        data: data || {},
      });

      return new Response(
        JSON.stringify({ success: true, recipient_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare data payload with automatic ID inclusion
    const notificationData = { ...(data || {}) };
    
    // Automatically include relevant IDs for deep linking
    if (target_type === "event" && target_id) {
      notificationData.event_id = target_id;
    } else if (target_type === "group" && target_id) {
      notificationData.group_id = target_id;
    }
    
    // Prepare messages for Expo Push API
    const messages = pushTokens.map((pt) => ({
      to: pt.token,
      sound: "default",
      title,
      body,
      data: notificationData,
    }));

    // Send notifications via Expo Push API
    const expoPushUrl = "https://exp.host/--/api/v2/push/send";
    const response = await fetch(expoPushUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`Expo Push API error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Expo Push API result:", result);

    // Log the notification
    await supabaseClient.from("notifications_log").insert({
      title,
      body,
      target_type,
      target_id: target_id || null,
      sent_by: user.id,
      recipient_count: pushTokens.length,
      data: data || {},
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipient_count: pushTokens.length,
        expo_result: result 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});