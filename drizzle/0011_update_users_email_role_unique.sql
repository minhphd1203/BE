-- Drop the existing unique constraint on email
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";

-- Add composite unique index on (email, role)
CREATE UNIQUE INDEX "email_role_unique" ON "users" ("email", "role");
