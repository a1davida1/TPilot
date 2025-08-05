import { pgTable, serial, varchar, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  password: varchar("password", { length: 255 }).notNull().default(''),
  email: varchar("email", { length: 255 }),
  tier: varchar("tier", { length: 50 }).default("free").notNull(), // free, pro, premium
  provider: varchar("provider", { length: 50 }), // google, facebook, reddit
  providerId: varchar("provider_id", { length: 255 }),
  avatar: varchar("avatar", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contentGenerations = pgTable("content_generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  platform: varchar("platform", { length: 50 }).notNull(),
  style: varchar("style", { length: 50 }).notNull(),
  theme: varchar("theme", { length: 50 }).notNull(),
  titles: jsonb("titles").notNull(),
  content: text("content").notNull(),
  photoInstructions: jsonb("photo_instructions").notNull(),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertContentGenerationSchema = createInsertSchema(contentGenerations).omit({ id: true, createdAt: true });
export const insertUserSampleSchema = createInsertSchema(userSamples).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ContentGeneration = typeof contentGenerations.$inferSelect;
export type InsertContentGeneration = z.infer<typeof insertContentGenerationSchema>;

export type UserSample = typeof userSamples.$inferSelect;
export type InsertUserSample = z.infer<typeof insertUserSampleSchema>;

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;