import { 
  type User, 
  type InsertUser, 
  type ContentGeneration, 
  type InsertContentGeneration,
  type UserImage,
  type InsertUserImage,
  type SavedContent,
  type InsertSavedContent,
  users,
  userImages,
  contentGenerations,
  savedContent
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: string, profile: Partial<User>): Promise<User | undefined>;
  deleteUser(userId: string): Promise<void>;
  
  // Image management
  createUserImage(userId: string, image: InsertUserImage): Promise<UserImage>;
  getUserImages(userId: string): Promise<UserImage[]>;
  getImageById(imageId: string): Promise<UserImage | undefined>;
  updateImageProtection(imageId: string, protectedUrl: string, settings: any): Promise<UserImage | undefined>;
  deleteUserImage(imageId: string): Promise<void>;
  
  // Content generation
  createContentGeneration(generation: InsertContentGeneration & {
    titles: string[];
    content: string;
    photoInstructions?: any;
    generationType?: string;
    prompt?: string;
    imageId?: string;
    subreddit?: string;
    allowsPromotion?: string;
  }): Promise<ContentGeneration>;
  getUserContentGenerations(userId?: string): Promise<ContentGeneration[]>;
  getContentGenerationStats(): Promise<{
    totalGenerated: number;
    totalSaved: number;
    avgEngagement: number;
  }>;
  getLastGenerated(): Promise<ContentGeneration | undefined>;
  
  // Saved content
  saveContent(userId: string, savedContent: InsertSavedContent): Promise<SavedContent>;
  getUserSavedContent(userId: string): Promise<SavedContent[]>;
  deleteSavedContent(savedContentId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User management
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, profile: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(profile)
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  // Image management
  async createUserImage(userId: string, image: InsertUserImage): Promise<UserImage> {
    const [userImage] = await db
      .insert(userImages)
      .values({ 
        userId,
        originalFileName: image.originalFileName,
        originalUrl: image.originalUrl,
        tags: image.tags,
        protectionSettings: image.protectionSettings,
        isProtected: 'false'
      })
      .returning();
    return userImage;
  }

  async getUserImages(userId: string): Promise<UserImage[]> {
    return await db
      .select()
      .from(userImages)
      .where(eq(userImages.userId, userId))
      .orderBy(desc(userImages.createdAt));
  }

  async getImageById(imageId: string): Promise<UserImage | undefined> {
    const [image] = await db.select().from(userImages).where(eq(userImages.id, imageId));
    return image || undefined;
  }

  async updateImageProtection(imageId: string, protectedUrl: string, settings: any): Promise<UserImage | undefined> {
    const [image] = await db
      .update(userImages)
      .set({ 
        protectedUrl, 
        protectionSettings: settings,
        isProtected: 'true'
      })
      .where(eq(userImages.id, imageId))
      .returning();
    return image || undefined;
  }

  async deleteUserImage(imageId: string): Promise<void> {
    await db.delete(userImages).where(eq(userImages.id, imageId));
  }

  // Content generation
  async createContentGeneration(generation: InsertContentGeneration & {
    titles: string[];
    content: string;
    photoInstructions?: any;
    generationType?: string;
    prompt?: string;
    imageId?: string;
    subreddit?: string;
    allowsPromotion?: string;
  }): Promise<ContentGeneration> {
    const [contentGeneration] = await db
      .insert(contentGenerations)
      .values({
        ...generation,
        userId: null, // For now, not requiring auth
        generationType: generation.generationType || 'template',
        photoInstructions: generation.photoInstructions || undefined
      })
      .returning();
    return contentGeneration;
  }

  async getUserContentGenerations(userId?: string): Promise<ContentGeneration[]> {
    if (userId) {
      return await db
        .select()
        .from(contentGenerations)
        .where(eq(contentGenerations.userId, userId))
        .orderBy(desc(contentGenerations.createdAt));
    } else {
      return await db
        .select()
        .from(contentGenerations)
        .orderBy(desc(contentGenerations.createdAt))
        .limit(50);
    }
  }

  async getContentGenerationStats(): Promise<{
    totalGenerated: number;
    totalSaved: number;
    avgEngagement: number;
  }> {
    const totalGenerations = await db.select().from(contentGenerations);
    const savedGenerations = await db.select().from(savedContent);
    
    return {
      totalGenerated: totalGenerations.length,
      totalSaved: savedGenerations.length,
      avgEngagement: 89 // This could be calculated from actual engagement data
    };
  }

  async getLastGenerated(): Promise<ContentGeneration | undefined> {
    const [lastGeneration] = await db
      .select()
      .from(contentGenerations)
      .orderBy(desc(contentGenerations.createdAt))
      .limit(1);
    return lastGeneration || undefined;
  }

  // Saved content
  async saveContent(userId: string, savedContentData: InsertSavedContent): Promise<SavedContent> {
    const [saved] = await db
      .insert(savedContent)
      .values({ ...savedContentData, userId })
      .returning();
    return saved;
  }

  async getUserSavedContent(userId: string): Promise<SavedContent[]> {
    return await db
      .select()
      .from(savedContent)
      .where(eq(savedContent.userId, userId))
      .orderBy(desc(savedContent.createdAt));
  }

  async deleteSavedContent(savedContentId: string): Promise<void> {
    await db.delete(savedContent).where(eq(savedContent.id, savedContentId));
  }
}

export const storage = new DatabaseStorage();
