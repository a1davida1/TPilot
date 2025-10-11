-- Create feedback table for bug reports, feature requests, and user feedback
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Allow anonymous feedback
  type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature', 'general', 'praise')),
  message TEXT NOT NULL,
  page_url TEXT, -- URL where feedback was submitted
  user_agent TEXT, -- Browser/device info
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  admin_response TEXT, -- Admin's response to the feedback
  responded_at TIMESTAMP, -- When admin responded
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS feedback_user_id_idx ON feedback(user_id);
CREATE INDEX IF NOT EXISTS feedback_type_idx ON feedback(type);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON feedback(status);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback(created_at DESC);

-- Add comment on table
COMMENT ON TABLE feedback IS 'User feedback including bug reports, feature requests, and general feedback';
COMMENT ON COLUMN feedback.type IS 'Type of feedback: bug, feature, general, or praise';
COMMENT ON COLUMN feedback.status IS 'Current status: pending, in_progress, resolved, wont_fix, or duplicate';
COMMENT ON COLUMN feedback.page_url IS 'The URL/page where the feedback was submitted from';
COMMENT ON COLUMN feedback.user_agent IS 'Browser and device information for debugging';
COMMENT ON COLUMN feedback.admin_response IS 'Admin response or notes about the feedback';
