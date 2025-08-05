import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  bio: text("bio"),
  subscription: text("subscription").default("free"),
  isActive: text("is_active").default("true"),
  lastLoginAt: timestamp("last_login_at"),
  personalityProfile: jsonb("personality_profile").$type<{
    toneOfVoice: string; // casual, flirty, mysterious, confident
    contentStyle: string; // playful, sultry, artistic, authentic
    targetAudience: string; // general, niche, specific demographics
    personalBrand: string; // girl-next-door, alternative, luxury, etc.
    writingStyle: string; // short and punchy, detailed, storytelling
  }>(),
  preferences: jsonb("preferences").$type<{
    defaultPlatforms: string[];
    favoriteStyles: string[];
    contentLength: 'short' | 'medium' | 'long';
    includeEmojis: boolean;
    includeHashtags: boolean;
    promotionLevel: 'subtle' | 'moderate' | 'direct';
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userImages = pgTable("user_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  originalFileName: text("original_file_name").notNull(),
  protectedFileName: text("protected_file_name"),
  originalUrl: text("original_url").notNull(),
  protectedUrl: text("protected_url"),
  protectionSettings: jsonb("protection_settings").$type<{
    level: 'light' | 'standard' | 'heavy';
    blurIntensity: string;
    addNoise: boolean;
    resizePercent: number;
    cropPercent: number;
  }>(),
  tags: jsonb("tags").$type<string[]>().default([]),
  isProtected: text("is_protected").default('false'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contentGenerations = pgTable("content_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  imageId: varchar("image_id").references(() => userImages.id),
  platform: text("platform").notNull(), // 'reddit', 'twitter', 'instagram'
  style: text("style").notNull(), // 'playful', 'mysterious', 'bold', 'elegant'
  theme: text("theme").notNull(), // 'lifestyle', 'fashion', 'artistic'
  generationType: text("generation_type").notNull().default('template'), // 'template', 'ai', 'image-based'
  prompt: text("prompt"), // For AI generations
  titles: jsonb("titles").$type<string[]>().notNull(),
  content: text("content").notNull(),
  photoInstructions: jsonb("photo_instructions").$type<{
    lighting: string[];
    angles: string[];
    composition: string[];
    styling: string[];
    technical: string[];
  }>(),
  isSaved: text("is_saved").default('false'),
  subreddit: text("subreddit"),
  allowsPromotion: text("allows_promotion").default('no'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const savedContent = pgTable("saved_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  contentId: varchar("content_id").references(() => contentGenerations.id).notNull(),
  customTitle: text("custom_title"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContentGenerationSchema = createInsertSchema(contentGenerations).pick({
  platform: true,
  style: true,
  theme: true,
});

export const insertUserImageSchema = createInsertSchema(userImages).pick({
  originalFileName: true,
  originalUrl: true,
  protectionSettings: true,
  tags: true,
});

export const insertSavedContentSchema = createInsertSchema(savedContent).pick({
  contentId: true,
  customTitle: true,
  notes: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserImage = typeof userImages.$inferSelect;
export type InsertUserImage = z.infer<typeof insertUserImageSchema>;
export type ContentGeneration = typeof contentGenerations.$inferSelect;
export type InsertContentGeneration = z.infer<typeof insertContentGenerationSchema>;
export type SavedContent = typeof savedContent.$inferSelect;
export type InsertSavedContent = z.infer<typeof insertSavedContentSchema>;
