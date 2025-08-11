CREATE TABLE "user_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"url" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"is_protected" boolean DEFAULT false,
	"protection_level" varchar(50) DEFAULT 'none',
	"tags" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "content_generations" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "content_generations" ADD COLUMN "subreddit" varchar(100);--> statement-breakpoint
ALTER TABLE "content_generations" ADD COLUMN "allows_promotion" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_images" ADD CONSTRAINT "user_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;