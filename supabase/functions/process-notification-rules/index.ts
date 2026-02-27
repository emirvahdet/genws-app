// ============================================================================
// PROCESS NOTIFICATION RULES - Cron-based Edge Function
// Designed to be called by a cron job (every 30 minutes or hourly)
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
  hours_before: number | null;
  send_at_hour: number | null;
  send_at_minute: number | null;
  target_type: string;
  title_template: string;
  body_template: string;
}

interface Event {
  id: string;
  title: string;
  excerpt: string | null;
  location: string;
  start_date: string;
  capacity: number | null;
}

interface News {
  id: string;
  title: string;
  created_at: string;
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

    const results: { rule: string; entity: string; recipients: number; status: string }[] = [];
    const now = new Date();
    const currentHour = now.getUTCHours();

    // Get last check timestamps
    const { data: stateData } = await supabaseClient
      .from("notification_rule_state")
      .select("*")
      .eq("id", "default")
      .single();

    const lastEventCheck = stateData?.last_event_check ? new Date(stateData.last_event_check) : new Date(now.getTime() - 3600000);
    const lastNewsCheck = stateData?.last_news_check ? new Date(stateData.last_news_check) : new Date(now.getTime() - 3600000);

    // Fetch all active rules
    const { data: rules, error: rulesError } = await supabaseClient
      .from("notification_rules")
      .select("*")
      .eq("is_active", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========================================================================
    // PROCESS EACH RULE TYPE
    // ========================================================================

    for (const rule of rules as NotificationRule[]) {
      try {
        switch (rule.trigger_type) {
          case "event_created":
            await processEventCreated(supabaseClient, rule, lastEventCheck, results);
            break;

          case "event_full":
            await processEventFull(supabaseClient, rule, results);
            break;

          case "time_before_event":
            await processTimeBeforeEvent(supabaseClient, rule, now, currentHour, results);
            break;

          case "news_created":
            await processNewsCreated(supabaseClient, rule, lastNewsCheck, results);
            break;
        }
      } catch (ruleError) {
        console.error(`Error processing rule ${rule.name}:`, ruleError);
        results.push({ rule: rule.name, entity: "error", recipients: 0, status: "failed" });
      }
    }

    // Update last check timestamps
    await supabaseClient
      .from("notification_rule_state")
      .update({
        last_event_check: now.toISOString(),
        last_news_check: now.toISOString(),
        last_cron_run: now.toISOString(),
      })
      .eq("id", "default");

    return new Response(JSON.stringify({ message: "Processing complete", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in process-notification-rules:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================================
// PROCESS: EVENT CREATED
// ============================================================================
async function processEventCreated(
  supabase: any,
  rule: NotificationRule,
  lastCheck: Date,
  results: any[]
) {
  // Find events created since last check
  const { data: newEvents } = await supabase
    .from("events")
    .select("id, title, excerpt, location, start_date")
    .gt("created_at", lastCheck.toISOString())
    .order("created_at", { ascending: false });

  if (!newEvents || newEvents.length === 0) return;

  for (const event of newEvents as Event[]) {
    // Check if already sent for this rule + event
    const { data: existingLog } = await supabase
      .from("notification_rule_logs")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("trigger_entity_id", event.id)
      .maybeSingle();

    if (existingLog) continue;

    // Send notification
    const result = await sendNotificationForRule(supabase, rule, event, "event");
    results.push({ rule: rule.name, entity: event.title, ...result });
  }
}

// ============================================================================
// PROCESS: EVENT FULL
// ============================================================================
async function processEventFull(
  supabase: any,
  rule: NotificationRule,
  results: any[]
) {
  // Find events with capacity that are now full
  const { data: events } = await supabase
    .from("events")
    .select("id, title, excerpt, location, start_date, capacity")
    .not("capacity", "is", null)
    .gt("capacity", 0)
    .gte("start_date", new Date().toISOString());

  if (!events || events.length === 0) return;

  for (const event of events as Event[]) {
    // Check if already sent for this rule + event
    const { data: existingLog } = await supabase
      .from("notification_rule_logs")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("trigger_entity_id", event.id)
      .maybeSingle();

    if (existingLog) continue;

    // Count active registrations
    const { count } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("refund_processed", false);

    // Check if event is full
    if (count && event.capacity && count >= event.capacity) {
      const result = await sendNotificationForRule(supabase, rule, event, "event");
      results.push({ rule: rule.name, entity: `${event.title} (FULL)`, ...result });
    }
  }
}

// ============================================================================
// PROCESS: TIME BEFORE EVENT
// ============================================================================
async function processTimeBeforeEvent(
  supabase: any,
  rule: NotificationRule,
  now: Date,
  currentHour: number,
  results: any[]
) {
  if (!rule.hours_before) return;

  // Check if current hour matches send_at_hour (if specified)
  if (rule.send_at_hour !== null && rule.send_at_hour !== currentHour) {
    return;
  }

  // Calculate the target time window
  const hoursBeforeMs = rule.hours_before * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() + hoursBeforeMs - 1800000); // -30 min buffer
  const windowEnd = new Date(now.getTime() + hoursBeforeMs + 1800000);   // +30 min buffer

  // Find events starting within the window
  const { data: events } = await supabase
    .from("events")
    .select("id, title, excerpt, location, start_date")
    .gte("start_date", windowStart.toISOString())
    .lte("start_date", windowEnd.toISOString());

  if (!events || events.length === 0) return;

  for (const event of events as Event[]) {
    // Check if already sent for this rule + event
    const { data: existingLog } = await supabase
      .from("notification_rule_logs")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("trigger_entity_id", event.id)
      .maybeSingle();

    if (existingLog) continue;

    const result = await sendNotificationForRule(supabase, rule, event, "event");
    results.push({ rule: rule.name, entity: `${event.title} (${rule.hours_before}h before)`, ...result });
  }
}

// ============================================================================
// PROCESS: NEWS CREATED
// ============================================================================
async function processNewsCreated(
  supabase: any,
  rule: NotificationRule,
  lastCheck: Date,
  results: any[]
) {
  // Find news created since last check
  const { data: newNews } = await supabase
    .from("news")
    .select("id, title, created_at")
    .eq("published", true)
    .gt("created_at", lastCheck.toISOString())
    .order("created_at", { ascending: false });

  if (!newNews || newNews.length === 0) return;

  for (const news of newNews as News[]) {
    // Check if already sent for this rule + news
    const { data: existingLog } = await supabase
      .from("notification_rule_logs")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("trigger_entity_id", news.id)
      .maybeSingle();

    if (existingLog) continue;

    const result = await sendNotificationForRule(supabase, rule, news, "news");
    results.push({ rule: rule.name, entity: news.title, ...result });
  }
}

// ============================================================================
// SEND NOTIFICATION FOR RULE
// ============================================================================
async function sendNotificationForRule(
  supabase: any,
  rule: NotificationRule,
  entity: Event | News,
  entityType: "event" | "news"
): Promise<{ recipients: number; status: string }> {
  try {
    // Replace template variables
    let title = rule.title_template;
    let body = rule.body_template;

    if (entityType === "event") {
      const event = entity as Event;
      const eventDate = new Date(event.start_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      title = title
        .replace(/{event_title}/g, event.title)
        .replace(/{event_date}/g, eventDate)
        .replace(/{event_location}/g, event.location || "")
        .replace(/{event_excerpt}/g, event.excerpt || "");

      body = body
        .replace(/{event_title}/g, event.title)
        .replace(/{event_date}/g, eventDate)
        .replace(/{event_location}/g, event.location || "")
        .replace(/{event_excerpt}/g, event.excerpt || "");
    } else {
      const news = entity as News;
      title = title.replace(/{news_title}/g, news.title);
      body = body.replace(/{news_title}/g, news.title);
    }

    // Fetch push tokens based on target_type
    let pushTokens: { token: string }[] = [];

    if (rule.target_type === "all") {
      const { data } = await supabase.from("push_tokens").select("token");
      pushTokens = data || [];
    } else if (rule.target_type === "admin") {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      if (adminRoles && adminRoles.length > 0) {
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data } = await supabase
          .from("push_tokens")
          .select("token")
          .in("user_id", adminIds);
        pushTokens = data || [];
      }
    } else if (rule.target_type === "registered" && entityType === "event") {
      const event = entity as Event;
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", event.id)
        .eq("refund_processed", false);

      if (registrations && registrations.length > 0) {
        const userIds = registrations.map((r: any) => r.user_id);
        const { data } = await supabase
          .from("push_tokens")
          .select("token")
          .in("user_id", userIds);
        pushTokens = data || [];
      }
    } else if (rule.target_type === "not_registered" && entityType === "event") {
      const event = entity as Event;
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", event.id)
        .eq("refund_processed", false);

      const registeredUserIds = (registrations || []).map((r: any) => r.user_id);

      let query = supabase.from("push_tokens").select("token, user_id");
      const { data: allTokens } = await query;

      pushTokens = (allTokens || []).filter(
        (t: any) => !registeredUserIds.includes(t.user_id)
      );
    }

    if (pushTokens.length === 0) {
      // Log with 0 recipients
      await supabase.from("notification_rule_logs").insert([{
        rule_id: rule.id,
        trigger_entity_type: entityType,
        trigger_entity_id: entity.id,
        title,
        body,
        target_type: rule.target_type,
        recipient_count: 0,
        status: "sent",
      }]);
      return { recipients: 0, status: "sent" };
    }

    // Send via Expo Push API
    const messages = pushTokens.map((pt) => ({
      to: pt.token,
      sound: "default",
      title,
      body,
      data: {
        [`${entityType}_id`]: entity.id,
      },
    }));

    // Send in batches of 100
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

    // Log the notification
    await supabase.from("notification_rule_logs").insert([{
      rule_id: rule.id,
      trigger_entity_type: entityType,
      trigger_entity_id: entity.id,
      title,
      body,
      target_type: rule.target_type,
      recipient_count: pushTokens.length,
      status: "sent",
    }]);

    return { recipients: pushTokens.length, status: "sent" };

  } catch (error) {
    console.error("Error sending notification:", error);

    // Log the failure
    await supabase.from("notification_rule_logs").insert([{
      rule_id: rule.id,
      trigger_entity_type: entityType,
      trigger_entity_id: entity.id,
      title: rule.title_template,
      body: rule.body_template,
      target_type: rule.target_type,
      recipient_count: 0,
      status: "failed",
      error_message: (error as Error).message,
    }]);

    return { recipients: 0, status: "failed" };
  }
}
