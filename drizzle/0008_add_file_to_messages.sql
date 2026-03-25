-- Add file_url column to messages table to support file/image attachments
ALTER TABLE messages ADD COLUMN file_url TEXT;

-- Create index on file_url for faster lookups if needed
CREATE INDEX idx_messages_file_url ON messages(file_url) WHERE file_url IS NOT NULL;
