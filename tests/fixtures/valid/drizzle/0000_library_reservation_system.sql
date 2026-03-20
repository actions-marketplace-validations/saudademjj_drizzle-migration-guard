CREATE TYPE "public"."role" AS ENUM('admin', 'student');--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"seat_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"seat_number" text NOT NULL,
	"zone_id" integer NOT NULL,
	"is_available" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"student_id" text NOT NULL,
	"phone" text,
	"role" "role" DEFAULT 'student' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"floor" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;