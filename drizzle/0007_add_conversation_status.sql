-- Add conversation status tracking to messages table
-- Allows admin/inspector to close conversations so buyers/sellers can't actively message them

ALTER TABLE messages ADD COLUMN conversation_status VARCHAR(50) DEFAULT 'active'; -- 'active' or 'closed'
ALTER TABLE messages ADD COLUMN conversation_closed_at TIMESTAMP;
ALTER TABLE messages ADD COLUMN conversation_closed_by UUID REFERENCES users(id);

-- Create index for faster conversation status queries
CREATE INDEX idx_messages_conversation_status ON messages(sender_id, receiver_id, conversation_status);
