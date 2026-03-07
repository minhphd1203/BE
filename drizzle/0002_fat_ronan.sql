CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bike_id" uuid NOT NULL,
	"inspector_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'passed' NOT NULL,
	"overall_condition" varchar(50) NOT NULL,
	"frame_condition" varchar(50),
	"brake_condition" varchar(50),
	"drivetrain_condition" varchar(50),
	"wheel_condition" varchar(50),
	"inspection_note" text,
	"recommendation" text,
	"inspection_images" text[] DEFAULT '{}',
	"report_file" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bikes" ADD COLUMN "is_verified" varchar(20) DEFAULT 'not_verified';--> statement-breakpoint
ALTER TABLE "bikes" ADD COLUMN "inspection_status" varchar(50) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_bike_id_bikes_id_fk" FOREIGN KEY ("bike_id") REFERENCES "public"."bikes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;