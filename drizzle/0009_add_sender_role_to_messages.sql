-- Add sender_role column to messages table to track role when message was sent
ALTER TABLE messages ADD COLUMN sender_role VARCHAR(50) NOT NULL DEFAULT 'buyer';

-- Create index on sender_role for faster filtering
CREATE INDEX idx_messages_sender_role ON messages(sender_role);
