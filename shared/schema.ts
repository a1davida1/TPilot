import { pgTable, serial, varchar, text, integer, timestamp, jsonb, boolean, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { growthTrendSchema, type GrowthTrend } from "./growth-trends.js";

// ==========================================
// PROTECTION LEVEL VALIDATION SCHEMAS
// ==========================================

export const protectionLevelEnum = z.enum(['light', 'standard', 'heavy'], {
  errorMap: () => ({ message: 'Protection level must be light, standard, or heavy' })
});

export const imageProcessingOptionsSchema = z.object({
  blurIntensity: z.number().min(0).max(5).optional().default(1),
  noiseIntensity: z.number().min(0).max(50).optional().default(10),
  resizePercent: z.number().min(50).max(100).optional().default(90),
  cropPercent: z.number().min(0).max(15).optional().default(0),
  quality: z.number().min(60).max(100).optional().default(88)
});

export const uploadRequestSchema = z.object({
  protectionLevel: protectionLevelEnum.optional().default('standard'),
  customSettings: imageProcessingOptionsSchema.optional(),
  useCustom: z.boolean().optional().default(false),
  addWatermark: z.boolean().optional()
});

export type ProtectionLevel = z.infer<typeof protectionLevelEnum>;
export type ImageProcessingOptions = z.infer<typeof imageProcessingOptionsSchema>;
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull().default(''),
  email: varchar("email", { length: 255 }).unique(),
  role: varchar("role", { length: 50 }).default("user"), // user, admin, moderator
  isAdmin: boolean("is_admin").default(false),
  emailVerified: boolean("email_verified").default(false).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  tier: varchar("tier", { length: 50 }).default("free").notNull(), // free, starter, pro
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  subscriptionStatus: varchar("subscription_status", { length: 50 }).default("inactive").notNull(), // active, inactive, cancelled, past_due, expired
  trialEndsAt: timestamp("trial_ends_at"),
  provider: varchar("provider", { length: 50 }), // google, facebook, reddit
  providerId: varchar("provider_id", { length: 255 }),
  avatar: text("avatar"),
  bio: text("bio"),
  referralCodeId: integer("referral_code_id"),
  referredBy: integer("referred_by"),
  redditUsername: varchar("reddit_username", { length: 255 }),
  redditAccessToken: text("reddit_access_token"),
  redditRefreshToken: text("reddit_refresh_token"),
  redditId: varchar("reddit_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  bannedAt: timestamp("banned_at"),
  suspendedUntil: timestamp("suspended_until"),
  banReason: text("ban_reason"),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  passwordResetAt: timestamp("password_reset_at"),
  deletedAt: timestamp("deleted_at"),
  isDeleted: boolean("is_deleted").default(false),
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

// Lead model for waitlist functionality
export const leads = pgTable("leads", {
  id: varchar("id", { length: 25 }).primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  platformTags: jsonb("platform_tags").$type<string[]>().notNull(), // ["reddit","x","onlyfans","fansly"]
  painPoint: text("pain_point"),
  utmSource: varchar("utm_source", { length: 255 }),
  utmMedium: varchar("utm_medium", { length: 255 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  utmContent: varchar("utm_content", { length: 255 }),
  utmTerm: varchar("utm_term", { length: 255 }),
  referrer: varchar("referrer", { length: 500 }),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
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

export const creatorAccounts = pgTable(
  "creator_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    handle: varchar("handle", { length: 100 }).notNull(),
    platformUsername: varchar("platform_username", { length: 255 }),
    oauthToken: text("oauth_token").notNull(),
    oauthRefresh: text("oauth_refresh").notNull(),
    status: varchar("status", { length: 20 }).default("ok").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userPlatformUnique: unique("creator_accounts_user_platform_idx").on(
      table.userId,
      table.platform
    ),
  })
);

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

// ==========================================
// REDDIT COMMUNITY RULE SCHEMAS
// ==========================================

export const ruleAllowanceSchema = z.enum(['yes', 'limited', 'no']);
export type RuleAllowance = z.infer<typeof ruleAllowanceSchema>;

// ==========================================
// CANONICAL REDDIT COMMUNITY ENUMS
// ==========================================

export const redditCommunitySellingPolicySchema = z.enum(['allowed', 'limited', 'not_allowed', 'unknown']);
export type RedditCommunitySellingPolicy = z.infer<typeof redditCommunitySellingPolicySchema>;

export const promotionAllowedSchema = z.enum(['yes', 'no', 'limited', 'subtle', 'strict', 'unknown']);
export type PromotionAllowed = z.infer<typeof promotionAllowedSchema>;

export const categorySchema = z.enum([
  'age', 'amateur', 'appearance', 'body_type', 'cam', 'clothing', 'comparison',
  'content_type', 'cosplay', 'couples', 'dancer', 'ethnicity', 'fetish',
  'fitness', 'gaming', 'general', 'gonewild', 'lifestyle', 'natural',
  'niche', 'reveal', 'selling', 'social', 'specific', 'style', 'theme'
]);
export type Category = z.infer<typeof categorySchema>;

export const competitionLevelSchema = z.enum(['low', 'medium', 'high']).nullable();
export type CompetitionLevel = z.infer<typeof competitionLevelSchema>;

// Growth trend schema and type are imported from ./growth-trends.js

export const modActivitySchema = z.enum(['low', 'medium', 'high', 'unknown']).nullable();
export type ModActivity = z.infer<typeof modActivitySchema>;

// Nested rule structure schemas
export const eligibilityRulesSchema = z.object({
  minKarma: z.number().nullable().optional(),
  minAccountAgeDays: z.number().nullable().optional(),
  verificationRequired: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
}).optional();

export const contentRulesSchema = z.object({
  sellingPolicy: redditCommunitySellingPolicySchema.optional(),
  watermarksAllowed: z.boolean().nullable().optional(),
  promotionalLinks: ruleAllowanceSchema.nullable().optional(),
  requiresOriginalContent: z.boolean().optional(),
  nsfwRequired: z.boolean().optional(),
  titleGuidelines: z.array(z.string()).optional().default([]),
  contentGuidelines: z.array(z.string()).optional().default([]),
  linkRestrictions: z.array(z.string()).optional().default([]),
  bannedContent: z.array(z.string()).optional().default([]),
  formattingRequirements: z.array(z.string()).optional().default([]),
}).optional();

export const postingRulesSchema = z.object({
  maxPostsPerDay: z.number().nullable().optional(),
  cooldownHours: z.number().nullable().optional(),
}).optional();

// New structured rule schema
export const redditCommunityRuleSetSchema = z.object({
  eligibility: eligibilityRulesSchema,
  content: contentRulesSchema,
  posting: postingRulesSchema,
  notes: z.string().nullable().optional(),
}).optional();

// Legacy schema for backwards compatibility
export const legacyRedditCommunityRuleSetSchema = z.object({
  minKarma: z.number().nullable().optional(),
  minAccountAge: z.number().nullable().optional(), // in days (legacy)
  minAccountAgeDays: z.number().nullable().optional(), // in days (new)
  watermarksAllowed: z.boolean().nullable().optional(),
  sellingAllowed: redditCommunitySellingPolicySchema.optional(),
  promotionalLinksAllowed: ruleAllowanceSchema.optional(),
  titleRules: z.array(z.string()).optional().default([]),
  contentRules: z.array(z.string()).optional().default([]),
  bannedContent: z.array(z.string()).optional().default([]),
  formattingRequirements: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
  verificationRequired: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  requiresOriginalContent: z.boolean().optional(),
  nsfwRequired: z.boolean().optional(),
  maxPostsPerDay: z.number().nullable().optional(),
  cooldownHours: z.number().nullable().optional()
}).optional();

export type RedditCommunityRuleSet = z.infer<typeof redditCommunityRuleSetSchema>;
export type EligibilityRules = z.infer<typeof eligibilityRulesSchema>;
export type ContentRules = z.infer<typeof contentRulesSchema>;
export type PostingRules = z.infer<typeof postingRulesSchema>;
export type LegacyRedditCommunityRuleSet = z.infer<typeof legacyRedditCommunityRuleSetSchema>;

// Posting limits schema
export const postingLimitsSchema = z.object({
  perDay: z.number().nullable().optional(),
  perWeek: z.number().nullable().optional(),
  daily: z.number().nullable().optional(), // legacy support
  weekly: z.number().nullable().optional(), // legacy support
  cooldownHours: z.number().nullable().optional()
}).nullable().optional();

export type PostingLimits = z.infer<typeof postingLimitsSchema>;

// ==========================================
// CANONICAL REDDIT COMMUNITY ZOD SCHEMA
// ==========================================

export const redditCommunityZodSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  members: z.number(),
  engagementRate: z.number(),
  category: categorySchema,
  verificationRequired: z.boolean(),
  promotionAllowed: promotionAllowedSchema,
  postingLimits: postingLimitsSchema,
  rules: redditCommunityRuleSetSchema,
  bestPostingTimes: z.array(z.string()).optional(),
  averageUpvotes: z.number().nullable().optional(),
  successProbability: z.number().nullable().optional(),
  growthTrend: growthTrendSchema.optional(),
  modActivity: modActivitySchema.optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  competitionLevel: competitionLevelSchema.optional()
});

export const redditCommunityArrayZodSchema = z.array(redditCommunityZodSchema);

export type RedditCommunityZod = z.infer<typeof redditCommunityZodSchema>;

// Default rule set factory
export const createDefaultRules = (): RedditCommunityRuleSet => ({
  eligibility: {
    minKarma: null,
    minAccountAgeDays: null,
    verificationRequired: false,
    requiresApproval: false,
  },
  content: {
    sellingPolicy: undefined,
    watermarksAllowed: null,
    promotionalLinks: null,
    requiresOriginalContent: false,
    nsfwRequired: false,
    titleGuidelines: [],
    contentGuidelines: [],
    linkRestrictions: [],
    bannedContent: [],
    formattingRequirements: [],
  },
  posting: {
    maxPostsPerDay: null,
    cooldownHours: null,
  },
  notes: null,
});

// Legacy default rule factory for backwards compatibility
export const createDefaultLegacyRules = (): LegacyRedditCommunityRuleSet => ({
  minKarma: null,
  minAccountAge: null,
  minAccountAgeDays: null,
  watermarksAllowed: null,
  sellingAllowed: undefined,
  promotionalLinksAllowed: undefined,
  titleRules: [],
  contentRules: [],
  bannedContent: [],
  formattingRequirements: [],
  notes: undefined,
  verificationRequired: false,
  requiresApproval: false,
  requiresOriginalContent: false,
  nsfwRequired: false,
  maxPostsPerDay: null,
  cooldownHours: null
});

export const redditCommunities = pgTable("reddit_communities", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  members: integer("members").notNull(),
  engagementRate: integer("engagement_rate").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  verificationRequired: boolean("verification_required").default(false).notNull(),
  promotionAllowed: varchar("promotion_allowed", { length: 20 }).default("no").notNull(),
  postingLimits: jsonb("posting_limits"),
  rules: jsonb("rules").$type<RedditCommunityRuleSet>(),
  bestPostingTimes: jsonb("best_posting_times").$type<string[]>(),
  averageUpvotes: integer("average_upvotes"),
  successProbability: integer("success_probability"),
  growthTrend: varchar("growth_trend", { length: 20 }),
  modActivity: varchar("mod_activity", { length: 20 }),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>(),
  competitionLevel: varchar("competition_level", { length: 20 })
});
export type RedditCommunity = typeof redditCommunities.$inferSelect;
export type InsertRedditCommunity = typeof redditCommunities.$inferInsert;
export const insertRedditCommunitySchema = createInsertSchema(redditCommunities);

// Helper function to normalize legacy rules to structured rules
export const normalizeRulesToStructured = (legacyRules: LegacyRedditCommunityRuleSet | null | undefined): RedditCommunityRuleSet | null => {
  if (!legacyRules) return null;
  
  return {
    eligibility: {
      minKarma: legacyRules.minKarma ?? null,
      minAccountAgeDays: legacyRules.minAccountAgeDays ?? legacyRules.minAccountAge ?? null,
      verificationRequired: legacyRules.verificationRequired ?? false,
      requiresApproval: legacyRules.requiresApproval ?? false,
    },
    content: {
      sellingPolicy: legacyRules.sellingAllowed,
      watermarksAllowed: legacyRules.watermarksAllowed ?? null,
      promotionalLinks: legacyRules.promotionalLinksAllowed ?? null,
      requiresOriginalContent: legacyRules.requiresOriginalContent ?? false,
      nsfwRequired: legacyRules.nsfwRequired ?? false,
      titleGuidelines: legacyRules.titleRules ?? [],
      contentGuidelines: legacyRules.contentRules ?? [],
      linkRestrictions: [],
      bannedContent: legacyRules.bannedContent ?? [],
      formattingRequirements: legacyRules.formattingRequirements ?? [],
    },
    posting: {
      maxPostsPerDay: legacyRules.maxPostsPerDay ?? null,
      cooldownHours: legacyRules.cooldownHours ?? null,
    },
    notes: legacyRules.notes ?? null,
  };
};

// Helper function to infer selling policy from rules
export const inferSellingPolicyFromRules = (rules: RedditCommunityRuleSet | null): RedditCommunitySellingPolicy => {
  if (!rules?.content?.sellingPolicy) return 'unknown';
  return rules.content.sellingPolicy;
};

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
}, (table) => ({
  inputHashIdx: index("ai_generations_input_hash_idx").on(table.inputHash),
}));

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
export const insertCreatorAccountSchema = createInsertSchema(creatorAccounts);
export const insertSubredditRuleSchema = createInsertSchema(subredditRules);
export const insertPostTemplateSchema = createInsertSchema(postTemplates);
export const insertPostPreviewSchema = createInsertSchema(postPreviews);
export const insertPostJobSchema = createInsertSchema(postJobs);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const insertInvoiceSchema = createInsertSchema(invoices);
export const insertReferralCodeSchema = createInsertSchema(referralCodes);
export const insertReferralSchema = createInsertSchema(referrals);
export const insertEventLogSchema = createInsertSchema(eventLogs);
export const insertFeatureFlagSchema = createInsertSchema(featureFlags);
export const insertMediaAssetSchema = createInsertSchema(mediaAssets);
export const insertMediaUsageSchema = createInsertSchema(mediaUsages);
export const insertAiGenerationSchema = createInsertSchema(aiGenerations);
export const insertQueueJobSchema = createInsertSchema(queueJobs);
export const insertPostRateLimitSchema = createInsertSchema(postRateLimits);
export const insertPostDuplicateSchema = createInsertSchema(postDuplicates);


// Phase 5 schemas already included above

// Insert schemas for existing tables
export const insertUserSchema = createInsertSchema(users);
export const insertContentGenerationSchema = createInsertSchema(contentGenerations);
export const insertUserSampleSchema = createInsertSchema(userSamples);
export const insertUserPreferenceSchema = createInsertSchema(userPreferences);
export const insertUserImageSchema = createInsertSchema(userImages);
export const insertLeadSchema = createInsertSchema(leads);
export const insertVerificationTokenSchema = createInsertSchema(verificationTokens);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type InsertVerificationToken = z.infer<typeof insertVerificationTokenSchema>;

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

export const referralRewards = pgTable("referral_rewards", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => users.id).notNull(),
  referredId: integer("referred_id").references(() => users.id).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReferralReward = typeof referralRewards.$inferSelect;
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


// Tax & Expense Tracking Tables
export const expenseCategories = pgTable("expense_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  legalExplanation: text("legal_explanation").notNull(),
  deductionPercentage: integer("deduction_percentage").default(100).notNull(), // 0-100
  itsDeductionCode: varchar("its_deduction_code", { length: 50 }), // IRS code reference
  examples: jsonb("examples").$type<string[]>().notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  defaultBusinessPurpose: text("default_business_purpose"), // Default business purpose for this category
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  categoryId: integer("category_id").references(() => expenseCategories.id).notNull(),
  amount: integer("amount").notNull(), // in cents
  description: text("description").notNull(),
  vendor: varchar("vendor", { length: 255 }),
  expenseDate: timestamp("expense_date").notNull(),
  receiptUrl: varchar("receipt_url", { length: 500 }),
  receiptFileName: varchar("receipt_file_name", { length: 255 }),
  businessPurpose: text("business_purpose"), // Required for deduction
  deductionPercentage: integer("deduction_percentage").default(100).notNull(),
  tags: jsonb("tags").$type<string[]>(),
  isRecurring: boolean("is_recurring").default(false),
  recurringPeriod: varchar("recurring_period", { length: 20 }), // monthly, quarterly, yearly
  taxYear: integer("tax_year").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taxDeductionInfo = pgTable("tax_deduction_info", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description").notNull(),
  legalBasis: text("legal_basis").notNull(),
  requirements: jsonb("requirements").$type<string[]>().notNull(),
  limitations: text("limitations"),
  examples: jsonb("examples").$type<string[]>().notNull(),
  itsReference: varchar("its_reference", { length: 100 }),
  applicableFor: jsonb("applicable_for").$type<string[]>().notNull(), // content creators, influencers, etc.
  riskLevel: varchar("risk_level", { length: 20 }).default("low").notNull(), // low, medium, high
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PHASE 2: Social Media Integration Tables
export const socialMediaAccounts = pgTable("social_media_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(), // instagram, twitter, tiktok, youtube
  accountId: varchar("account_id", { length: 255 }).notNull(), // Platform account ID
  username: varchar("username", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  profilePicture: varchar("profile_picture", { length: 500 }),
  accessToken: varchar("access_token", { length: 1000 }),
  refreshToken: varchar("refresh_token", { length: 1000 }),
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  metadata: jsonb("metadata"), // Platform-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const socialMediaPosts = pgTable("social_media_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => socialMediaAccounts.id).notNull(),
  contentGenerationId: integer("content_generation_id").references(() => contentGenerations.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  platformPostId: varchar("platform_post_id", { length: 255 }), // ID from the platform
  content: text("content").notNull(),
  mediaUrls: jsonb("media_urls").$type<string[]>(), // Array of media URLs
  hashtags: jsonb("hashtags").$type<string[]>(), // Array of hashtags
  status: varchar("status", { length: 50 }).default("draft").notNull(), // draft, scheduled, published, failed
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  errorMessage: text("error_message"),
  engagement: jsonb("engagement").$type<{
    likes: number;
    comments: number;
    shares: number;
    views: number;
    retweets?: number;
    quotes?: number;
  }>(),
  lastEngagementSync: timestamp("last_engagement_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const platformEngagement = pgTable("platform_engagement", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => socialMediaAccounts.id).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  date: timestamp("date").notNull(),
  followers: integer("followers").default(0),
  following: integer("following").default(0),
  totalLikes: integer("total_likes").default(0),
  totalComments: integer("total_comments").default(0),
  totalShares: integer("total_shares").default(0),
  totalViews: integer("total_views").default(0),
  impressions: integer("impressions").default(0),
  reach: integer("reach").default(0),
  engagementRate: integer("engagement_rate").default(0), // Percentage * 100
  profileViews: integer("profile_views").default(0),
  metadata: jsonb("metadata"), // Platform-specific metrics
  createdAt: timestamp("created_at").defaultNow(),
});

export const postSchedule = pgTable("post_schedule", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contentGenerationId: integer("content_generation_id").references(() => contentGenerations.id),
  platforms: jsonb("platforms").$type<string[]>().notNull(), // Array of platform names
  scheduledTime: timestamp("scheduled_time").notNull(),
  timezone: varchar("timezone", { length: 100 }).default("UTC"),
  recurrence: varchar("recurrence", { length: 50 }), // none, daily, weekly, monthly
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, processing, completed, failed
  lastExecuted: timestamp("last_executed"),
  nextExecution: timestamp("next_execution"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PHASE 1: Comprehensive Analytics & Tracking Tables

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).unique().notNull(),
  userId: integer("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: varchar("referrer", { length: 500 }),
  utmSource: varchar("utm_source", { length: 255 }),
  utmMedium: varchar("utm_medium", { length: 255 }),
  utmCampaign: varchar("utm_campaign", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }), // mobile, desktop, tablet
  browser: varchar("browser", { length: 100 }),
  os: varchar("os", { length: 100 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // seconds
  pageCount: integer("page_count").default(0),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).references(() => userSessions.sessionId).notNull(),
  userId: integer("user_id").references(() => users.id),
  path: varchar("path", { length: 500 }).notNull(),
  title: varchar("title", { length: 500 }),
  referrer: varchar("referrer", { length: 500 }),
  timeOnPage: integer("time_on_page"), // seconds
  scrollDepth: integer("scroll_depth"), // percentage 0-100
  exitPage: boolean("exit_page").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contentViews = pgTable("content_views", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").references(() => contentGenerations.id).notNull(),
  sessionId: varchar("session_id", { length: 255 }).references(() => userSessions.sessionId),
  userId: integer("user_id").references(() => users.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  subreddit: varchar("subreddit", { length: 100 }),
  viewType: varchar("view_type", { length: 50 }).notNull(), // internal, external, shared
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrer: varchar("referrer", { length: 500 }),
  timeSpent: integer("time_spent"), // seconds viewing content
  createdAt: timestamp("created_at").defaultNow(),
});

export const engagementEvents = pgTable("engagement_events", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).references(() => userSessions.sessionId),
  userId: integer("user_id").references(() => users.id),
  eventType: varchar("event_type", { length: 100 }).notNull(), // click, hover, scroll, form_submit, etc.
  element: varchar("element", { length: 255 }), // button ID, link text, etc.
  page: varchar("page", { length: 500 }).notNull(),
  metadata: jsonb("metadata"), // additional event data
  value: integer("value"), // numeric value if applicable
  createdAt: timestamp("created_at").defaultNow(),
});

export const socialMetrics = pgTable("social_metrics", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").references(() => contentGenerations.id).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(),
  platformPostId: varchar("platform_post_id", { length: 255 }),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  saves: integer("saves").default(0),
  clicks: integer("clicks").default(0),
  engagementRate: integer("engagement_rate").default(0), // percentage * 100
  reach: integer("reach").default(0),
  impressions: integer("impressions").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyticsMetrics = pgTable("analytics_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  metricType: varchar("metric_type", { length: 100 }).notNull(), // daily, weekly, monthly
  date: timestamp("date").notNull(),
  totalViews: integer("total_views").default(0),
  totalEngagement: integer("total_engagement").default(0),
  contentGenerated: integer("content_generated").default(0),
  platformViews: jsonb("platform_views"), // {reddit: 100, instagram: 50}
  topContent: jsonb("top_content"), // [{id: 1, views: 100}]
  engagementRate: integer("engagement_rate").default(0), // percentage * 100
  growth: jsonb("growth"), // growth metrics compared to previous period
  revenue: integer("revenue").default(0), // cents
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userDateIdx: unique("analytics_metrics_user_date_idx").on(table.userId, table.date, table.metricType),
}));

// Relations
export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, { fields: [expenses.userId], references: [users.id] }),
  category: one(expenseCategories, { fields: [expenses.categoryId], references: [expenseCategories.id] }),
}));

// PHASE 2: Social Media Schema Validation
export const insertSocialMediaAccountSchema = createInsertSchema(socialMediaAccounts);
export const insertSocialMediaPostSchema = createInsertSchema(socialMediaPosts);
export const insertPlatformEngagementSchema = createInsertSchema(platformEngagement);
export const insertPostScheduleSchema = createInsertSchema(postSchedule);

// PHASE 1: Analytics Schema Validation
export const insertUserSessionSchema = createInsertSchema(userSessions);
export const insertPageViewSchema = createInsertSchema(pageViews);
export const insertContentViewSchema = createInsertSchema(contentViews);
export const insertEngagementEventSchema = createInsertSchema(engagementEvents);
export const insertSocialMetricSchema = createInsertSchema(socialMetrics);
export const insertAnalyticsMetricSchema = createInsertSchema(analyticsMetrics);

// Schemas for validation
export const insertExpenseCategorySchema = createInsertSchema(expenseCategories);
export const insertExpenseSchema = createInsertSchema(expenses);
export const insertTaxDeductionInfoSchema = createInsertSchema(taxDeductionInfo);

// PHASE 1: Analytics Types
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;
export type ContentView = typeof contentViews.$inferSelect;
export type InsertContentView = z.infer<typeof insertContentViewSchema>;
export type EngagementEvent = typeof engagementEvents.$inferSelect;
export type InsertEngagementEvent = z.infer<typeof insertEngagementEventSchema>;
export type SocialMetric = typeof socialMetrics.$inferSelect;
export type InsertSocialMetric = z.infer<typeof insertSocialMetricSchema>;
export type AnalyticsMetric = typeof analyticsMetrics.$inferSelect;
export type InsertAnalyticsMetric = z.infer<typeof insertAnalyticsMetricSchema>;

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertTaxDeductionInfo = z.infer<typeof insertTaxDeductionInfoSchema>;
export type TaxDeductionInfo = typeof taxDeductionInfo.$inferSelect;

// PHASE 2: Social Media Types
export type SocialMediaAccount = typeof socialMediaAccounts.$inferSelect;
export type InsertSocialMediaAccount = z.infer<typeof insertSocialMediaAccountSchema>;
export type SocialMediaPost = typeof socialMediaPosts.$inferSelect;
export type InsertSocialMediaPost = z.infer<typeof insertSocialMediaPostSchema>;
export type PlatformEngagement = typeof platformEngagement.$inferSelect;
export type InsertPlatformEngagement = z.infer<typeof insertPlatformEngagementSchema>;
export type PostSchedule = typeof postSchedule.$inferSelect;
export type InsertPostSchedule = z.infer<typeof insertPostScheduleSchema>;

// Admin Portal Enhancement Tables

// System monitoring and health logs
export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  level: varchar("level", { length: 20 }).notNull(), // info, warn, error, critical
  service: varchar("service", { length: 100 }).notNull(), // api, database, queue, auth
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  userId: integer("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Content moderation and flags
export const contentFlags = pgTable("content_flags", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").references(() => contentGenerations.id).notNull(),
  reportedById: integer("reported_by_id").references(() => users.id),
  reason: varchar("reason", { length: 100 }).notNull(), // spam, inappropriate, harmful
  description: text("description"),
  status: varchar("status", { length: 50 }).default("pending").notNull(), // pending, reviewed, approved, removed
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  actions: jsonb("actions").$type<{
    contentHidden?: boolean;
    userWarned?: boolean;
    userSuspended?: boolean;
    autoDetected?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User account actions (bans, suspensions, warnings)
export const userActions = pgTable("user_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // ban, suspend, warn, unban, tier_change
  reason: text("reason").notNull(),
  duration: integer("duration_hours"), // null for permanent
  metadata: jsonb("metadata").$type<{
    oldTier?: string;
    newTier?: string;
    ipBanned?: boolean;
    hardwareBanned?: boolean;
  }>(),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Admin activity audit log
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }), // user, content, system
  targetId: integer("target_id"),
  description: text("description").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for new admin tables
export const insertSystemLogSchema = createInsertSchema(systemLogs);
export const insertContentFlagSchema = createInsertSchema(contentFlags);
export const insertUserActionSchema = createInsertSchema(userActions);
export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog);

export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type InsertContentFlag = z.infer<typeof insertContentFlagSchema>;
export type InsertUserAction = z.infer<typeof insertUserActionSchema>;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

export type SystemLog = typeof systemLogs.$inferSelect;
export type ContentFlag = typeof contentFlags.$inferSelect;
export type UserAction = typeof userActions.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;

// ==========================================
// SHADOWBAN DETECTION SCHEMAS
// ==========================================

export type ShadowbanStatusType = 'clear' | 'suspected' | 'unknown';

export interface ShadowbanSubmissionSummary {
  id: string;
  createdUtc: number;
  permalink: string;
  title?: string;
  subreddit?: string;
}

export interface ShadowbanEvidenceResponse {
  username: string;
  checkedAt: string;
  privateCount: number;
  publicCount: number;
  privateSubmissions: ShadowbanSubmissionSummary[];
  publicSubmissions: ShadowbanSubmissionSummary[];
  missingSubmissionIds: string[];
}

export interface ShadowbanCheckApiResponse {
  status: ShadowbanStatusType;
  reason?: string;
  evidence: ShadowbanEvidenceResponse;
}