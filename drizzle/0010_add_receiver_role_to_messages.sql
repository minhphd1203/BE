-- Add receiver_role column to messages table to track role when message was received
ALTER TABLE messages ADD COLUMN receiver_role VARCHAR(50) NOT NULL DEFAULT 'seller';

-- Create index on receiver_role for faster filtering
CREATE INDEX idx_messages_receiver_role ON messages(receiver_role);
