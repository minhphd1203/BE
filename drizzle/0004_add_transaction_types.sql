ALTER TABLE "transactions" ADD COLUMN "transaction_type" varchar(50) NOT NULL DEFAULT 'full_payment';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "remaining_balance" double precision;
