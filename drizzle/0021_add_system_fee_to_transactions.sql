-- Add system fee columns to transactions table
-- system_fee: 5% of original bike price (seller bears this cost)
-- seller_net_amount: amount - system_fee (what seller actually receives in payout)
-- original_bike_price: stores the bike price for remaining_payment fee calculation

ALTER TABLE transactions ADD COLUMN system_fee DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN seller_net_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN original_bike_price DECIMAL(10, 2);

-- Set default values for existing transactions (no fee for past transactions)
UPDATE transactions SET system_fee = 0, seller_net_amount = amount WHERE system_fee = 0;

-- Create index for payout queries
CREATE INDEX idx_transactions_seller_net_amount ON transactions(seller_net_amount);
