import { pgTable, serial, varchar, text, integer, timestamp, jsonb, boolean, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==========================================
// REDDIT COMMUNITY RULE SCHEMAS
// ==========================================

export const ruleAllowanceSchema = z.enum(['yes', 'limited', 'no']);

export const redditCommunitySellingPolicySchema = z.enum(['allowed', 'limited', 'not_allowed', 'unknown']);

export const promotionAllowedSchema = z.enum(['yes', 'no', 'limited', 'subtle', 'strict', 'unknown']);

const SEED_COMMUNITY_CATEGORIES = [
    'age', 'amateur', 'appearance', 'body_type', 'cam', 'clothing', 'comparison',
    'content_type', 'cosplay', 'couples', 'dancer', 'ethnicity', 'fetish',
    'fitness', 'gaming', 'general', 'gonewild', 'lifestyle', 'natural',
    'niche', 'reveal', 'selling', 'social', 'specific', 'style', 'teasing', 'theme',
    // Lightweight seed dataset coverage
    'art', 'health'
];
const PRODUCTION_OBSERVED_COMMUNITY_CATEGORIES = [
    'beauty', 'business', 'education', 'entertainment', 'fashion', 'finance',
    'food', 'music', 'news', 'sports', 'support', 'technology', 'travel'
];
const REDDIT_SYNC_COMMUNITY_CATEGORY_TYPES = [
    'public', 'restricted', 'private', 'archived', 'employees_only', 'gold_only', 'gold_restricted'
];
export const KNOWN_REDDIT_COMMUNITY_CATEGORIES = [
    ...SEED_COMMUNITY_CATEGORIES,
    ...PRODUCTION_OBSERVED_COMMUNITY_CATEGORIES,
    ...REDDIT_SYNC_COMMUNITY_CATEGORY_TYPES
];
const knownRedditCategoryEnum = z.enum(KNOWN_REDDIT_COMMUNITY_CATEGORIES);
const fallbackRedditCategorySchema = z.string().trim().min(1, {
    message: 'Category cannot be empty'
}).max(100, {
    message: 'Category must be 100 characters or fewer'
});
export const categorySchema = z.union([knownRedditCategoryEnum, fallbackRedditCategorySchema]);

export const competitionLevelSchema = z.enum(['low', 'medium', 'high']).nullable();

export const modActivitySchema = z.enum(['low', 'medium', 'high', 'unknown']).nullable();

const growthTrendSchema = z.enum(['up', 'stable', 'down']).nullable();

export const redditCommunityRuleSetSchema = z.object({
    minKarma: z.number().nullable().optional(),
    minAccountAge: z.number().nullable().optional(),
    minAccountAgeDays: z.number().nullable().optional(),
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

export const postingLimitsSchema = z.object({
    perDay: z.number().nullable().optional(),
    perWeek: z.number().nullable().optional(),
    daily: z.number().nullable().optional(),
    weekly: z.number().nullable().optional(),
    cooldownHours: z.number().nullable().optional()
}).nullable().optional();

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

export const createDefaultRules = () => ({
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
    rules: jsonb("rules"),
    bestPostingTimes: jsonb("best_posting_times"),
    averageUpvotes: integer("average_upvotes"),
    successProbability: integer("success_probability"),
    growthTrend: varchar("growth_trend", { length: 20 }),
    modActivity: varchar("mod_activity", { length: 20 }),
    description: text("description"),
    tags: jsonb("tags"),
    competitionLevel: varchar("competition_level", { length: 20 })
});

export const insertRedditCommunitySchema = createInsertSchema(redditCommunities);
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 255 }).unique().notNull(),
    password: varchar("password", { length: 255 }).notNull().default(''),
    email: varchar("email", { length: 255 }),
    emailVerified: boolean("email_verified").default(false).notNull(),
    firstName: varchar("first_name", { length: 255 }), // Added missing column
    lastName: varchar("last_name", { length: 255 }), // Added missing column
    tier: varchar("tier", { length: 50 }).default("free").notNull(), // free, pro, premium, pro_plus
    subscriptionStatus: varchar("subscription_status", { length: 50 }).default("free").notNull(), // Added missing column
    trialEndsAt: timestamp("trial_ends_at"), // For trial management
    provider: varchar("provider", { length: 50 }), // google, facebook, reddit
    providerId: varchar("provider_id", { length: 255 }),
    avatar: varchar("avatar", { length: 500 }),
    referralCodeId: integer("referral_code_id"), // Will reference referralCodes.id
    referredBy: integer("referred_by"), // Added missing column
    createdAt: timestamp("created_at").defaultNow(),
});
export const contentGenerations = pgTable("content_generations", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    platform: varchar("platform", { length: 50 }).notNull(),
    style: varchar("style", { length: 50 }).notNull(),
    theme: varchar("theme", { length: 50 }).notNull(),
    titles: jsonb("titles").$type().notNull(),
    content: text("content").notNull(),
    photoInstructions: jsonb("photo_instructions").$type().notNull(),
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
    platformTags: jsonb("platform_tags").$type().notNull(), // ["reddit","x","onlyfans","fansly"]
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
    platformUsername: varchar("platform_username", { length: 255 }), // Added missing column
    oauthToken: text("oauth_token").notNull(),
    oauthRefresh: text("oauth_refresh").notNull(),
    status: varchar("status", { length: 20 }).default("ok").notNull(), // "ok" | "limited" | "banned"
    isActive: boolean("is_active").default(true).notNull(), // Added missing column
    metadata: jsonb("metadata"), // Added missing column
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
export const savedContent = pgTable("saved_content", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    platform: varchar("platform", { length: 50 }),
    tags: jsonb("tags"),
    metadata: jsonb("metadata"),
    contentGenerationId: integer("content_generation_id").references(() => contentGenerations.id),
    socialMediaPostId: integer("social_media_post_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    userIdIdx: index("saved_content_user_id_idx").on(table.userId),
    contentGenerationIdx: index("saved_content_content_generation_id_idx").on(table.contentGenerationId),
    socialMediaPostIdx: index("saved_content_social_media_post_id_idx").on(table.socialMediaPostId),
}));
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
export const insertSavedContentSchema = createInsertSchema(savedContent);
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
