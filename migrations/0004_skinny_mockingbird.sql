CREATE TABLE "verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reddit_username" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reddit_access_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reddit_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reddit_id" varchar(255);--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;