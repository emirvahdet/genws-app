-- ============================================================================
-- NOTIFICATION RULES SYSTEM
-- Automated push notification rule engine
-- ============================================================================

-- ============================================================================
-- PART 1: Add excerpt column to events table (if not exists)
-- ============================================================================
-- Note: Based on codebase analysis, excerpt column likely already exists.
-- This is a safe "IF NOT EXISTS" check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'excerpt'
  ) THEN
    ALTER TABLE events ADD COLUMN excerpt TEXT;
  END IF;
END $$;

-- ============================================================================
-- PART 2: Create notification_rules table
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic info
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Trigger configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'event_created',      -- When a new event is created
    'event_full',         -- When an event reaches full capacity
    'time_before_event',  -- X hours before an event starts
    'news_created',       -- When a new news item is published
    'custom'              -- For future extensibility
  )),
  
  -- Timing configuration
  timing_type TEXT NOT NULL DEFAULT 'immediate' CHECK (timing_type IN ('immediate', 'scheduled')),
  hours_before INTEGER,           -- For time_before_event: how many hours before
  send_at_hour INTEGER CHECK (send_at_hour >= 0 AND send_at_hour <= 23),    -- Hour to send (0-23)
  send_at_minute INTEGER DEFAULT 0 CHECK (send_at_minute >= 0 AND send_at_minute <= 59), -- Minute to send (0-59)
  
  -- Target audience
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN (
    'all',            -- All members with push tokens
    'registered',     -- Only users registered for the event
    'not_registered', -- Users NOT registered for the event
    'admin'           -- Admin users only
  )),
  
  -- Message templates (supports variables like {event_title}, {event_date}, etc.)
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  -- Additional data to include in notification payload
  data_template JSONB,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notification_rules
CREATE INDEX IF NOT EXISTS idx_notification_rules_is_active ON notification_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_rules_trigger_type ON notification_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_notification_rules_created_at ON notification_rules(created_at DESC);

-- ============================================================================
-- PART 3: Create notification_rule_logs table
-- Tracks sent notifications to prevent duplicates
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_rule_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Reference to the rule
  rule_id UUID NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  
  -- What triggered this notification
  trigger_entity_type TEXT NOT NULL CHECK (trigger_entity_type IN ('event', 'news')),
  trigger_entity_id UUID NOT NULL,
  
  -- Notification details
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'partial')),
  error_message TEXT,
  
  -- Metadata
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate sends for same rule + entity combination
  CONSTRAINT unique_rule_entity UNIQUE (rule_id, trigger_entity_id)
);

-- Create indexes for notification_rule_logs
CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_rule_id ON notification_rule_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_trigger_entity ON notification_rule_logs(trigger_entity_type, trigger_entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_sent_at ON notification_rule_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_rule_logs_status ON notification_rule_logs(status);

-- ============================================================================
-- PART 4: Create helper table for tracking last processed timestamps
-- Used by cron job to know what's been processed
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_rule_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_event_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_news_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_cron_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default state row
INSERT INTO notification_rule_state (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 5: Enable RLS on all tables
-- ============================================================================
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rule_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rule_state ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: RLS Policies using user_roles table (NOT profiles.is_admin)
-- ============================================================================

-- notification_rules policies
-- Admins can view all rules
CREATE POLICY "Admins can view notification rules" ON notification_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Admins can create rules
CREATE POLICY "Admins can create notification rules" ON notification_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Admins can update rules
CREATE POLICY "Admins can update notification rules" ON notification_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Admins can delete rules
CREATE POLICY "Admins can delete notification rules" ON notification_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- notification_rule_logs policies
-- Admins can view all logs
CREATE POLICY "Admins can view notification rule logs" ON notification_rule_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Service role can insert logs (for Edge Functions)
CREATE POLICY "Service role can insert notification rule logs" ON notification_rule_logs
  FOR INSERT WITH CHECK (true);

-- notification_rule_state policies
-- Admins can view state
CREATE POLICY "Admins can view notification rule state" ON notification_rule_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

-- Service role can update state (for Edge Functions)
CREATE POLICY "Service role can update notification rule state" ON notification_rule_state
  FOR UPDATE USING (true);

-- ============================================================================
-- PART 7: Create updated_at trigger function (if not exists)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to notification_rules
DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to notification_rule_state
DROP TRIGGER IF EXISTS update_notification_rule_state_updated_at ON notification_rule_state;
CREATE TRIGGER update_notification_rule_state_updated_at
  BEFORE UPDATE ON notification_rule_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE
-- ============================================================================
