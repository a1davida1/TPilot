CREATE TABLE "billing_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"amount" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reddit_communities" ADD COLUMN "over18" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reddit_communities" ADD COLUMN "subscribers" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reddit_post_outcomes" ADD COLUMN "success" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reddit_post_outcomes" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "reddit_post_outcomes" ADD COLUMN "upvotes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reddit_post_outcomes" ADD COLUMN "views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;