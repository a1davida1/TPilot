import { pgTable, serial, varchar, text, integer, timestamp, jsonb, boolean, uuid, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull().default(''),
  email: varchar("email", { length: 255 }),
  emailVerified: boolean("email_verified").default(false).notNull(),
  tier: varchar("tier", { length: 50 }).default("free").notNull(), // free, pro, premium, pro_plus
  trialEndsAt: timestamp("trial_ends_at"), // For trial management
  provider: varchar("provider", { length: 50 }), // google, facebook, reddit
  providerId: varchar("provider_id", { length: 255 }),
  avatar: varchar("avatar", { length: 500 }),
  referralCodeId: integer("referral_code_id"), // Will reference referralCodes.id
  createdAt: timestamp("created_at").defaultNow(),
});

export const contentGenerations = pgTable("content_generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  style: varchar("style", { length: 50 }).notNull(),
  theme: varchar("theme", { length: 50 }).notNull(),
  titles: jsonb("titles").$type<string[]>().notNull(),
  content: text("content").notNull(),
  photoInstructions: jsonb("photo_instructions").$type<{
    lighting: string;
    cameraAngle: string;
    composition: string;
    styling: string;
    mood: string;
    technicalSettings: string;
  }>().notNull(),
  prompt: text("prompt"),
  subreddit: varchar("subreddit", { length: 100 }),
  allowsPromotion: boolean("allows_promotion").default(false),
  generationType: varchar("generation_type", { length: 50 }).default("ai").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSamples = pgTable("user_samples", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  style: varchar("style", { length: 50 }),
  performanceScore: integer("performance_score"), // 0-100 score
  tags: jsonb("tags"),
  imageUrls: jsonb("image_urls"), // Array of uploaded image URLs
  metadata: jsonb("metadata"), // Additional data like engagement stats
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).unique().notNull(),
  writingStyle: jsonb("writing_style"), // tone, voice, formality level
  contentPreferences: jsonb("content_preferences"), // preferred themes, topics
  prohibitedWords: jsonb("prohibited_words"), // words to avoid
  photoStyle: jsonb("photo_style"), // preferred photo instructions
  platformSettings: jsonb("platform_settings"), // platform-specific preferences
  fineTuningEnabled: boolean("fine_tuning_enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userImages = pgTable("user_images", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  isProtected: boolean("is_protected").default(false),
  protectionLevel: varchar("protection_level", { length: 50 }).default("none"),
  tags: jsonb("tags"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// New tables for Phase 1 expansion

export const creatorAccounts = pgTable("creator_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(), // "reddit"
  handle: varchar("handle", { length: 100 }).notNull(),
  oauthToken: text("oauth_token").notNull(),
  oauthRefresh: text("oauth_refresh").notNull(),
  status: varchar("status", { length: 20 }).default("ok").notNull(), // "ok" | "limited" | "banned"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subredditRules = pgTable("subreddit_rules", {
  id: serial("id").primaryKey(),
  subreddit: varchar("subreddit", { length: 100 }).unique().notNull(),
  rulesJson: jsonb("rules_json").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postTemplates = pgTable("post_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  titleTpl: text("title_tpl").notNull(),
  bodyTpl: text("body_tpl").notNull(),
  variables: jsonb("variables").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const postPreviews = pgTable("post_previews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  subreddit: varchar("subreddit", { length: 100 }).notNull(),
  titlePreview: text("title_preview").notNull(),
  bodyPreview: text("body_preview").notNull(),
  policyState: varchar("policy_state", { length: 10 }).notNull(), // "ok" | "warn" | "block"
  warnings: jsonb("warnings").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postJobs = pgTable("post_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  subreddit: varchar("subreddit", { length: 100 }).notNull(),
  titleFinal: text("title_final").notNull(),
  bodyFinal: text("body_final").notNull(),
  mediaKey: varchar("media_key", { length: 255 }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: varchar("status", { length: 20 }).default("queued").notNull(), // "queued" | "sent" | "failed" | "paused"
  resultJson: jsonb("result_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).unique().notNull(),
  status: varchar("status", { length: 20 }).notNull(), // "active" | "past_due" | "canceled"
  plan: varchar("plan", { length: 20 }).notNull(), // "free" | "pro"
  priceCents: integer("price_cents").notNull(),
  processor: varchar("processor", { length: 20 }).notNull(), // "ccbill" | "segpay" | "epoch" | "crypto"
  processorSubId: varchar("processor_sub_id", { length: 255 }),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").references(() => subscriptions.id).notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // "paid" | "failed" | "refunded"
  processor: varchar("processor", { length: 20 }).notNull(),
  processorRef: varchar("processor_ref", { length: 255 }),
  referralCodeId: integer("referral_code_id").references(() => referralCodes.id), // Phase 5: Referral simplification
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referralCodes = pgTable("referral_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  ownerId: integer("owner_id"), // Will reference users.id
  sharePct: integer("share_pct").default(20).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").references(() => referralCodes.id).notNull(),
  referrerId: integer("referrer_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const eventLogs = pgTable("event_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  type: varchar("type", { length: 100 }).notNull(),
  meta: jsonb("meta").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 100 }).primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  threshold: integer("threshold"), // Use integer for percentage (0-100)
  meta: jsonb("meta"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  key: varchar("key", { length: 255 }).unique().notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  bytes: integer("bytes").notNull(),
  mime: varchar("mime", { length: 100 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  visibility: varchar("visibility", { length: 30 }).default("private").notNull(), // "private" | "preview-watermarked"
  lastUsedAt: timestamp("last_used_at").defaultNow(), // Phase 5: For auto-pruning unused assets
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sha256Idx: unique("media_sha256_idx").on(table.sha256), // Phase 5: Deduplication
}));

export const mediaUsages = pgTable("media_usages", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").references(() => mediaAssets.id).notNull(),
  usedInType: varchar("used_in_type", { length: 50 }).notNull(), // "template" | "post" | "ai-context"
  usedInId: varchar("used_in_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiGenerations = pgTable("ai_generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  provider: varchar("provider", { length: 20 }).notNull(), // "gemini" | "openai"
  model: varchar("model", { length: 50 }).notNull(),
  inputHash: varchar("input_hash", { length: 64 }).notNull(),
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Phase 5: Queue abstraction - PgQueue implementation
export const queueJobs = pgTable("queue_jobs", {
  id: serial("id").primaryKey(),
  queueName: varchar("queue_name", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // "pending" | "active" | "completed" | "failed" | "delayed"
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  delayUntil: timestamp("delay_until"),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Phase 5: Rate limiting per subreddit
export const postRateLimits = pgTable("post_rate_limits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  subreddit: varchar("subreddit", { length: 100 }).notNull(),
  lastPostAt: timestamp("last_post_at").notNull(),
  postCount24h: integer("post_count_24h").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userSubredditIdx: unique("post_rate_limits_user_subreddit_idx").on(table.userId, table.subreddit),
}));

// Phase 5: Near-duplicate detection
export const postDuplicates = pgTable("post_duplicates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(), // MinHash or Levenshtein-based hash
  title: text("title").notNull(),
  body: text("body").notNull(),
  subreddit: varchar("subreddit", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for new tables
export const insertCreatorAccountSchema = createInsertSchema(creatorAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubredditRuleSchema = createInsertSchema(subredditRules).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPostTemplateSchema = createInsertSchema(postTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPostPreviewSchema = createInsertSchema(postPreviews).omit({ id: true, createdAt: true });
export const insertPostJobSchema = createInsertSchema(postJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertReferralCodeSchema = createInsertSchema(referralCodes).omit({ id: true, createdAt: true });
export const insertReferralSchema = createInsertSchema(referrals).omit({ id: true, createdAt: true });
export const insertEventLogSchema = createInsertSchema(eventLogs).omit({ id: true, createdAt: true });
export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({ updatedAt: true });
export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({ id: true, createdAt: true });
export const insertMediaUsageSchema = createInsertSchema(mediaUsages).omit({ id: true, createdAt: true });
export const insertAiGenerationSchema = createInsertSchema(aiGenerations).omit({ id: true, createdAt: true });
export const insertQueueJobSchema = createInsertSchema(queueJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPostRateLimitSchema = createInsertSchema(postRateLimits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPostDuplicateSchema = createInsertSchema(postDuplicates).omit({ id: true, createdAt: true });

// Phase 5 schemas already included above

// Insert schemas for existing tables
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertContentGenerationSchema = createInsertSchema(contentGenerations).omit({ id: true, createdAt: true });
export const insertUserSampleSchema = createInsertSchema(userSamples).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserImageSchema = createInsertSchema(userImages).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ContentGeneration = typeof contentGenerations.$inferSelect;
export type InsertContentGeneration = z.infer<typeof insertContentGenerationSchema>;

export type UserSample = typeof userSamples.$inferSelect;
export type InsertUserSample = z.infer<typeof insertUserSampleSchema>;

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;

export type UserImage = typeof userImages.$inferSelect;
export type InsertUserImage = z.infer<typeof insertUserImageSchema>;

// Types for new tables
export type CreatorAccount = typeof creatorAccounts.$inferSelect;
export type InsertCreatorAccount = z.infer<typeof insertCreatorAccountSchema>;

export type SubredditRule = typeof subredditRules.$inferSelect;
export type InsertSubredditRule = z.infer<typeof insertSubredditRuleSchema>;

export type PostTemplate = typeof postTemplates.$inferSelect;
export type InsertPostTemplate = z.infer<typeof insertPostTemplateSchema>;

export type PostPreview = typeof postPreviews.$inferSelect;
export type InsertPostPreview = z.infer<typeof insertPostPreviewSchema>;

export type PostJob = typeof postJobs.$inferSelect;
export type InsertPostJob = z.infer<typeof insertPostJobSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = z.infer<typeof insertReferralCodeSchema>;

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export type EventLog = typeof eventLogs.$inferSelect;
export type InsertEventLog = z.infer<typeof insertEventLogSchema>;

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;

export type MediaUsage = typeof mediaUsages.$inferSelect;
export type InsertMediaUsage = z.infer<typeof insertMediaUsageSchema>;

export type AiGeneration = typeof aiGenerations.$inferSelect;
export type InsertAiGeneration = z.infer<typeof insertAiGenerationSchema>;

// Phase 5: Types for new tables
export type QueueJob = typeof queueJobs.$inferSelect;
export type InsertQueueJob = z.infer<typeof insertQueueJobSchema>;

export type PostRateLimit = typeof postRateLimits.$inferSelect;
export type InsertPostRateLimit = z.infer<typeof insertPostRateLimitSchema>;

export type PostDuplicate = typeof postDuplicates.$inferSelect;
export type InsertPostDuplicate = z.infer<typeof insertPostDuplicateSchema>;