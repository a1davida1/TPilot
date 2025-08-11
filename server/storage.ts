
import {
  type User,
  type InsertUser,
  type ContentGeneration,
  type InsertContentGeneration,
  type UserSample,
  type InsertUserSample,
  type UserPreference,
  type InsertUserPreference,
  type UserImage,
  type InsertUserImage,
  users,
  contentGenerations,
  userSamples,
  userPreferences,
  userImages
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTier(userId: number, tier: string): Promise<void>;
  updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserEmailVerified(userId: number, verified: boolean): Promise<void>;
  deleteUser(userId: number): Promise<void>;

  // Generation operations
  createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getGenerationsByUserId(userId: number): Promise<ContentGeneration[]>;
  createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getUserContentGenerations(userId: number): Promise<ContentGeneration[]>;
  getContentGenerationStats(userId: number): Promise<{ total: number; thisWeek: number; thisMonth: number; totalGenerations?: number }>;
  getLastGenerated(userId: number): Promise<ContentGeneration | undefined>;

  // Sample operations
  createUserSample(sample: InsertUserSample): Promise<UserSample>;
  getUserSamples(userId: number): Promise<UserSample[]>;
  deleteUserSample(sampleId: number, userId: number): Promise<void>;

  // Preference operations
  getUserPreferences(userId: number): Promise<UserPreference | undefined>;
  updateUserPreferences(userId: number, preferences: InsertUserPreference): Promise<UserPreference>;

  // Image operations
  createUserImage(image: InsertUserImage): Promise<UserImage>;
  getUserImages(userId: number): Promise<UserImage[]>;
  getUserImage(imageId: number, userId: number): Promise<UserImage | undefined>;
  deleteUserImage(imageId: number, userId: number): Promise<void>;
}

class PostgreSQLStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    console.log('Storage: Looking for user with ID:', id);
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      const user = result[0];
      if (user) {
        console.log('Storage: Found user:', { id: user.id, username: user.username });
      } else {
        console.log('Storage: User not found');
      }
      return user;
    } catch (error) {
      console.error('Storage: Error getting user:', error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error('Storage: Error getting all users:', error);
      return [];
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Storage: Error getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Storage: Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const result = await db.insert(users).values(userData).returning();
      const user = result[0];
      console.log('Storage: Created user:', { id: user.id, username: user.username });
      return user;
    } catch (error) {
      console.error('Storage: Error creating user:', error);
      throw error;
    }
  }

  async updateUserTier(userId: number, tier: string): Promise<void> {
    try {
      await db.update(users).set({ tier }).where(eq(users.id, userId));
    } catch (error) {
      console.error('Storage: Error updating user tier:', error);
      throw error;
    }
  }

  async updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined> {
    try {
      const result = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return result[0];
    } catch (error) {
      console.error('Storage: Error updating user profile:', error);
      return undefined;
    }
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    try {
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
      console.log('Storage: Password updated for user:', userId);
    } catch (error) {
      console.error('Storage: Error updating user password:', error);
      throw error;
    }
  }

  async updateUserEmailVerified(userId: number, verified: boolean): Promise<void> {
    try {
      await db.update(users).set({ emailVerified: verified }).where(eq(users.id, userId));
      console.log('Storage: Email verification status updated for user:', userId);
    } catch (error) {
      console.error('Storage: Error updating email verification:', error);
      throw error;
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch (error) {
      console.error('Storage: Error deleting user:', error);
      throw error;
    }
  }

  // Generation operations
  async createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    try {
      const result = await db.insert(contentGenerations).values(gen).returning();
      return result[0];
    } catch (error) {
      console.error('Storage: Error creating generation:', error);
      throw error;
    }
  }

  async getGenerationsByUserId(userId: number): Promise<ContentGeneration[]> {
    try {
      return await db.select().from(contentGenerations)
        .where(eq(contentGenerations.userId, userId))
        .orderBy(desc(contentGenerations.createdAt));
    } catch (error) {
      console.error('Storage: Error getting generations by user ID:', error);
      return [];
    }
  }

  async createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    return this.createGeneration(gen);
  }

  async getUserContentGenerations(userId: number): Promise<ContentGeneration[]> {
    return this.getGenerationsByUserId(userId);
  }

  async getContentGenerationStats(userId: number): Promise<{ total: number; thisWeek: number; thisMonth: number; totalGenerations?: number }> {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [totalResult, weekResult, monthResult] = await Promise.all([
        db.select({ count: count() }).from(contentGenerations).where(eq(contentGenerations.userId, userId)),
        db.select({ count: count() }).from(contentGenerations)
          .where(and(eq(contentGenerations.userId, userId), gte(contentGenerations.createdAt, oneWeekAgo))),
        db.select({ count: count() }).from(contentGenerations)
          .where(and(eq(contentGenerations.userId, userId), gte(contentGenerations.createdAt, oneMonthAgo)))
      ]);

      return {
        total: totalResult[0]?.count || 0,
        thisWeek: weekResult[0]?.count || 0,
        thisMonth: monthResult[0]?.count || 0,
        totalGenerations: totalResult[0]?.count || 0
      };
    } catch (error) {
      console.error('Storage: Error getting content generation stats:', error);
      return { total: 0, thisWeek: 0, thisMonth: 0 };
    }
  }

  async getLastGenerated(userId: number): Promise<ContentGeneration | undefined> {
    try {
      const result = await db.select().from(contentGenerations)
        .where(eq(contentGenerations.userId, userId))
        .orderBy(desc(contentGenerations.createdAt))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Storage: Error getting last generated:', error);
      return undefined;
    }
  }

  // Sample operations
  async createUserSample(sample: InsertUserSample): Promise<UserSample> {
    try {
      const result = await db.insert(userSamples).values(sample).returning();
      return result[0];
    } catch (error) {
      console.error('Storage: Error creating user sample:', error);
      throw error;
    }
  }

  async getUserSamples(userId: number): Promise<UserSample[]> {
    try {
      return await db.select().from(userSamples)
        .where(eq(userSamples.userId, userId))
        .orderBy(desc(userSamples.createdAt));
    } catch (error) {
      console.error('Storage: Error getting user samples:', error);
      return [];
    }
  }

  async deleteUserSample(sampleId: number, userId: number): Promise<void> {
    try {
      await db.delete(userSamples).where(and(eq(userSamples.id, sampleId), eq(userSamples.userId, userId)));
    } catch (error) {
      console.error('Storage: Error deleting user sample:', error);
      throw error;
    }
  }

  // Preference operations
  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    try {
      const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Storage: Error getting user preferences:', error);
      return undefined;
    }
  }

  async updateUserPreferences(userId: number, preferences: InsertUserPreference): Promise<UserPreference> {
    try {
      // Try to update first
      const updateResult = await db.update(userPreferences)
        .set({ ...preferences, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId))
        .returning();

      if (updateResult.length > 0) {
        return updateResult[0];
      }

      // If no rows were updated, insert new preferences
      const insertResult = await db.insert(userPreferences)
        .values({ ...preferences, userId })
        .returning();
      return insertResult[0];
    } catch (error) {
      console.error('Storage: Error updating user preferences:', error);
      throw error;
    }
  }

  // Image operations
  async createUserImage(image: InsertUserImage): Promise<UserImage> {
    try {
      const result = await db.insert(userImages).values(image).returning();
      return result[0];
    } catch (error) {
      console.error('Storage: Error creating user image:', error);
      throw error;
    }
  }

  async getUserImages(userId: number): Promise<UserImage[]> {
    try {
      return await db.select().from(userImages)
        .where(eq(userImages.userId, userId))
        .orderBy(desc(userImages.createdAt));
    } catch (error) {
      console.error('Storage: Error getting user images:', error);
      return [];
    }
  }

  async getUserImage(imageId: number, userId: number): Promise<UserImage | undefined> {
    try {
      const result = await db.select().from(userImages)
        .where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Storage: Error getting user image:', error);
      return undefined;
    }
  }

  async deleteUserImage(imageId: number, userId: number): Promise<void> {
    try {
      await db.delete(userImages).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)));
    } catch (error) {
      console.error('Storage: Error deleting user image:', error);
      throw error;
    }
  }
}

// Create and export the storage instance
export const storage = new PostgreSQLStorage();
