CREATE TABLE "expense_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"legal_explanation" text NOT NULL,
	"deduction_percentage" integer DEFAULT 100 NOT NULL,
	"its_deduction_code" varchar(50),
	"examples" jsonb NOT NULL,
	"icon" varchar(50) NOT NULL,
	"color" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"description" text NOT NULL,
	"vendor" varchar(255),
	"expense_date" timestamp NOT NULL,
	"receipt_url" varchar(500),
	"receipt_file_name" varchar(255),
	"business_purpose" text,
	"deduction_percentage" integer DEFAULT 100 NOT NULL,
	"tags" jsonb,
	"is_recurring" boolean DEFAULT false,
	"recurring_period" varchar(20),
	"tax_year" integer NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_deduction_info" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"legal_basis" text NOT NULL,
	"requirements" jsonb NOT NULL,
	"limitations" text,
	"examples" jsonb NOT NULL,
	"its_reference" varchar(100),
	"applicable_for" jsonb NOT NULL,
	"risk_level" varchar(20) DEFAULT 'low' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;