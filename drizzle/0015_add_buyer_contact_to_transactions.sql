-- Add buyer contact information to transactions table
ALTER TABLE transactions ADD COLUMN buyer_phone varchar(20);
ALTER TABLE transactions ADD COLUMN buyer_email varchar(255);
ALTER TABLE transactions ADD COLUMN buyer_address text;
