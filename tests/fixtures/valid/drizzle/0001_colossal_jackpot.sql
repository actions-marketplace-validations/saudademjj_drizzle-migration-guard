ALTER TABLE "seats" ADD COLUMN "position_x" numeric(6, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "position_y" numeric(6, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "position_z" numeric(6, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "rotation" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "seat_type" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "facilities" text;--> statement-breakpoint
ALTER TABLE "seats" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "color" text DEFAULT '#3B82F6';--> statement-breakpoint
ALTER TABLE "zones" ADD COLUMN "bounding_box" text;