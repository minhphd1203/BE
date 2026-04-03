-- Add thread_id column to messages table to link messages to conversation threads
-- This is a foreign key reference to conversation_threads(id)
ALTER TABLE messages ADD COLUMN thread_id uuid REFERENCES conversation_threads(id) ON DELETE CASCADE;

-- Create index for faster message lookups by thread
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
