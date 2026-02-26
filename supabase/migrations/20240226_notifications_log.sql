-- Create notifications_log table
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'group', 'event')),
  target_id UUID,
  sent_by UUID NOT NULL REFERENCES profiles(id),
  recipient_count INTEGER DEFAULT 0,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_log_sent_by ON notifications_log(sent_by);
CREATE INDEX IF NOT EXISTS idx_notifications_log_target_type ON notifications_log(target_type);
CREATE INDEX IF NOT EXISTS idx_notifications_log_created_at ON notifications_log(created_at DESC);

-- Enable RLS
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all notification logs
CREATE POLICY "Admins can view all notification logs" ON notifications_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Admins can insert notification logs
CREATE POLICY "Admins can insert notification logs" ON notifications_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );
