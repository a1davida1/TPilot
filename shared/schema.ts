import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const contentGenerations = pgTable("content_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  platform: text("platform").notNull(), // 'reddit', 'twitter', 'instagram'
  style: text("style").notNull(), // 'playful', 'mysterious', 'bold', 'elegant'
  theme: text("theme").notNull(), // 'lifestyle', 'fashion', 'artistic'
  titles: jsonb("titles").$type<string[]>().notNull(),
  content: text("content").notNull(),
  photoInstructions: jsonb("photo_instructions").$type<{
    lighting: string[];
    angles: string[];
    composition: string[];
    styling: string[];
    technical: string[];
  }>().notNull(),
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContentGeneration = typeof contentGenerations.$inferSelect;
export type InsertContentGeneration = z.infer<typeof insertContentGenerationSchema>;
