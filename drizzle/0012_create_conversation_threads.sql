-- Create conversation_threads table to track thread metadata separately
-- Allows admin/inspector to close conversation threads blocking buyer/seller from messaging
CREATE TABLE conversation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id uuid NOT NULL REFERENCES users(id),
  participant2_id uuid NOT NULL REFERENCES users(id),
  bike_id uuid REFERENCES bikes(id),
  status varchar(50) NOT NULL DEFAULT 'open', -- 'open' or 'closed'
  closed_at timestamp,
  closed_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Create indexes for faster thread lookups
CREATE INDEX idx_conversation_threads_participant1 ON conversation_threads(participant1_id);
CREATE INDEX idx_conversation_threads_participant2 ON conversation_threads(participant2_id);
CREATE INDEX idx_conversation_threads_bike_id ON conversation_threads(bike_id);
CREATE INDEX idx_conversation_threads_status ON conversation_threads(status);
CREATE INDEX idx_conversation_threads_updated_at ON conversation_threads(updated_at DESC);
