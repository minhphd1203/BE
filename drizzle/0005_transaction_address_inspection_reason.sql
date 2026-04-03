ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_role" varchar(50) DEFAULT 'buyer' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "receiver_role" varchar(50) DEFAULT 'seller' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "address" text;--> statement-breakpoint
CREATE UNIQUE INDEX "email_role_unique" ON "users" USING btree ("email","role");