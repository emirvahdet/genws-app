// ============================================================================
// TRIGGER NOTIFICATION RULE - Immediate Trigger Edge Function
// Called by database webhooks when events or news are created
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  timing_type: string;
  target_type: string;
  title_template: string;
  body_template: string;
}

interface TriggerPayload {
  type: "INSERT";
  table: string;
  record: any;
  schema: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const payload: TriggerPayload = await req.json();
    const { table, record } = payload;

    if (!record || !record.id) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let triggerType: string;
    let entityType: "event" | "news";

    if (table === "events") {
      triggerType = "event_created";
      entityType = "event";
    } else if (table === "news") {
      triggerType = "news_created";
      entityType = "news";
    } else {
      return new Response(JSON.stringify({ message: "Table not supported" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching active rules with immediate timing
    const { data: rules, error: rulesError } = await supabaseClient
      .from("notification_rules")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", triggerType)
      .eq("timing_type", "immediate");

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No matching rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { rule: string; recipients: number; status: string }[] = [];

    for (const rule of rules as NotificationRule[]) {
      try {
        // Check if already sent
        const { data: existingLog } = await supabaseClient
          .from("notification_rule_logs")
          .select("id")
          .eq("rule_id", rule.id)
          .eq("trigger_entity_id", record.id)
          .maybeSingle();

        if (existingLog) {
          results.push({ rule: rule.name, recipients: 0, status: "skipped" });
          continue;
        }

        // Process template
        let title = rule.title_template;
        let body = rule.body_template;

        if (entityType === "event") {
          const eventDate = new Date(record.start_date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });

          title = title
            .replace(/{event_title}/g, record.title || "")
            .replace(/{event_date}/g, eventDate)
            .replace(/{event_location}/g, record.location || "")
            .replace(/{event_excerpt}/g, record.excerpt || "");

          body = body
            .replace(/{event_title}/g, record.title || "")
            .replace(/{event_date}/g, eventDate)
            .replace(/{event_location}/g, record.location || "")
            .replace(/{event_excerpt}/g, record.excerpt || "");
        } else {
          title = title.replace(/{news_title}/g, record.title || "");
          body = body.replace(/{news_title}/g, record.title || "");
        }

        // Fetch push tokens
        let pushTokens: { token: string }[] = [];

        if (rule.target_type === "all") {
          const { data } = await supabaseClient.from("push_tokens").select("token");
          pushTokens = data || [];
        } else if (rule.target_type === "admin") {
          const { data: adminRoles } = await supabaseClient
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

          if (adminRoles && adminRoles.length > 0) {
            const adminIds = adminRoles.map((r: any) => r.user_id);
            const { data } = await supabaseClient
              .from("push_tokens")
              .select("token")
              .in("user_id", adminIds);
            pushTokens = data || [];
          }
        }

        if (pushTokens.length === 0) {
          await supabaseClient.from("notification_rule_logs").insert([{
            rule_id: rule.id,
            trigger_entity_type: entityType,
            trigger_entity_id: record.id,
            title,
            body,
            target_type: rule.target_type,
            recipient_count: 0,
            status: "sent",
          }]);
          results.push({ rule: rule.name, recipients: 0, status: "sent" });
          continue;
        }

        // Send via Expo Push API
        const messages = pushTokens.map((pt) => ({
          to: pt.token,
          sound: "default",
          title,
          body,
          data: { [`${entityType}_id`]: record.id },
        }));

        const batchSize = 100;
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(batch),
          });
        }

        // Log
        await supabaseClient.from("notification_rule_logs").insert([{
          rule_id: rule.id,
          trigger_entity_type: entityType,
          trigger_entity_id: record.id,
          title,
          body,
          target_type: rule.target_type,
          recipient_count: pushTokens.length,
          status: "sent",
        }]);

        results.push({ rule: rule.name, recipients: pushTokens.length, status: "sent" });

      } catch (ruleError) {
        console.error(`Error processing rule ${rule.name}:`, ruleError);
        results.push({ rule: rule.name, recipients: 0, status: "failed" });
      }
    }

    return new Response(JSON.stringify({ message: "Trigger processed", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in trigger-notification-rule:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
