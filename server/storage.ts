import {
  type User,
  type InsertUser,
  type ContentGeneration,
  type InsertContentGeneration,
  type UserPreference,
  type InsertUserPreference,
  type UserImage,
  type InsertUserImage,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Expense,
  type InsertExpense,
  type TaxDeductionInfo,
  type InsertTaxDeductionInfo,
  type SocialMediaAccount,
  type InsertSocialMediaAccount,
  type SocialMediaPost,
  type InsertSocialMediaPost,
  type PlatformEngagement,
  type InsertPlatformEngagement,
  type PostSchedule,
  type InsertPostSchedule,
  type SavedContent,
  type InsertSavedContent,
  type VerificationToken,
  type InsertVerificationToken,
  users,
  contentGenerations,
  userPreferences,
  userImages,
  expenseCategories,
  expenses,
  taxDeductionInfo,
  socialMediaAccounts,
  socialMediaPosts,
  savedContent,
  platformEngagement,
  postSchedule,
  verificationTokens,
  invoices,
  userSessions
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, sql, count, isNull } from "drizzle-orm";
import { safeLog } from './lib/logger-utils';

type ExpenseCategoryWithDefaults = ExpenseCategory & {
  defaultBusinessPurpose?: string | null;
};

export interface ExpenseTotalsRow {
  categoryName: string | null;
  amount: number;
  deductionPercentage: number;
}

export interface ExpenseTotalsSummary {
  total: number;
  deductible: number;
  byCategory: { [key: string]: number };
}

export function summarizeExpenseTotals(rows: ExpenseTotalsRow[]): ExpenseTotalsSummary {
  let total = 0;
  let deductible = 0;
  const byCategory: { [key: string]: number } = {};

  for (const row of rows) {
    const amount = row.amount;
    const deductionAmount = Math.round(amount * (row.deductionPercentage / 100));
    const categoryName = row.categoryName ?? 'Other';

    total += amount;
    deductible += deductionAmount;
    byCategory[categoryName] = (byCategory[categoryName] || 0) + deductionAmount;
  }

  return { total, deductible, byCategory };
}

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string, verified?: boolean): Promise<User | undefined>;
  getUserByEmail(email: string, verified?: boolean): Promise<User | undefined>;
  getUserByProviderId(provider: string, providerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTier(userId: number, tier: string): Promise<void>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;
  updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserEmailVerified(userId: number, verified: boolean): Promise<void>;
  createVerificationToken(token: InsertVerificationToken): Promise<VerificationToken>;
  getVerificationToken(token: string): Promise<VerificationToken | undefined>;
  deleteVerificationToken(token: string): Promise<void>;
  deleteUser(userId: number): Promise<void>;

  // Generation operations
  createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getGenerationsByUserId(userId: number): Promise<ContentGeneration[]>;
  createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getUserContentGenerations(userId: number): Promise<ContentGeneration[]>;
  getContentGenerationCount(): Promise<number>;
  getContentGenerationStats(userId: number): Promise<{ total: number; thisWeek: number; thisMonth: number; totalGenerations?: number }>;
  getLastGenerated(userId: number): Promise<ContentGeneration | undefined>;

  // Revenue operations
  getRevenue(): Promise<number>;


  // Preference operations
  getUserPreferences(userId: number): Promise<UserPreference | undefined>;
  updateUserPreferences(userId: number, preferences: InsertUserPreference): Promise<UserPreference>;

  // Image operations
  createUserImage(image: InsertUserImage): Promise<UserImage>;
  getUserImages(userId: number): Promise<UserImage[]>;
  getUserImage(imageId: number, userId: number): Promise<UserImage | undefined>;
  updateUserImage(imageId: number, userId: number, updates: Partial<UserImage>): Promise<UserImage>;
  deleteUserImage(imageId: number, userId: number): Promise<void>;

  // Streak operations
  calculateDailyStreak(userId: number): Promise<number>;

  // Admin operations
  getTotalUserCount(): Promise<number>;
  getActiveUserCount(): Promise<number>;
  getTotalContentGenerated(): Promise<number>;
  getSubscriptionCounts(): Promise<{ free: number; starter: number; pro: number; }>;

  // Generation limit operations
  getDailyGenerationCount(userId: number): Promise<number>;

  // Expense operations
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: number): Promise<ExpenseCategory | undefined>;
  updateExpenseCategory(id: number, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: number): Promise<void>;

  createExpense(expense: InsertExpense): Promise<Expense>;
  getUserExpenses(
    userId: number,
    taxYear?: number
  ): Promise<Array<Expense & { category: ExpenseCategory | null }>>;
  getExpense(id: number, userId: number): Promise<Expense | undefined>;
  updateExpense(id: number, userId: number, updates: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: number, userId: number): Promise<void>;
  getExpensesByCategory(userId: number, categoryId: number, taxYear?: number): Promise<Expense[]>;
  getExpensesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Expense[]>;
  getExpenseTotals(userId: number, taxYear?: number): Promise<{ total: number; deductible: number; byCategory: { [key: string]: number } }>;

  getTaxDeductionInfo(): Promise<TaxDeductionInfo[]>;
  getTaxDeductionInfoByCategory(category: string): Promise<TaxDeductionInfo[]>;
  createTaxDeductionInfo(info: InsertTaxDeductionInfo): Promise<TaxDeductionInfo>;

  // Saved content operations
  createSavedContent(content: InsertSavedContent): Promise<SavedContent>;
  getSavedContentById(id: number, userId: number): Promise<SavedContent | undefined>;
  getUserSavedContent(userId: number): Promise<SavedContent[]>;
  deleteSavedContent(id: number, userId: number): Promise<void>;

  // Social Media operations
  createSocialMediaAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount>;
  getUserSocialMediaAccounts(userId: number): Promise<SocialMediaAccount[]>;
  getSocialMediaAccount(accountId: number): Promise<SocialMediaAccount | undefined>;
  updateSocialMediaAccount(accountId: number, updates: Partial<SocialMediaAccount>): Promise<SocialMediaAccount>;
  deleteSocialMediaAccount(accountId: number): Promise<void>;

  createSocialMediaPost(post: InsertSocialMediaPost): Promise<SocialMediaPost>;
  getUserSocialMediaPosts(userId: number, filters?: { platform?: string; status?: string; limit?: number; offset?: number }): Promise<SocialMediaPost[]>;
  getSocialMediaPost(postId: number): Promise<SocialMediaPost | undefined>;
  updateSocialMediaPost(postId: number, updates: Partial<SocialMediaPost>): Promise<SocialMediaPost>;
  deleteSocialMediaPost(postId: number): Promise<void>;

  // Saved content operations
  createSavedContent(entry: InsertSavedContent): Promise<SavedContent>;
  getSavedContentById(id: number, userId: number): Promise<SavedContent | undefined>;
  getUserSavedContent(userId: number): Promise<SavedContent[]>;
  deleteSavedContent(id: number, userId: number): Promise<void>;

  createPlatformEngagement(engagement: InsertPlatformEngagement): Promise<PlatformEngagement>;
  getPlatformEngagement(accountId: number, date?: Date): Promise<PlatformEngagement[]>;

  createPostSchedule(schedule: InsertPostSchedule): Promise<PostSchedule>;
  getUserScheduledPosts(userId: number): Promise<PostSchedule[]>;
  getPostSchedule(scheduleId: number): Promise<PostSchedule | undefined>;
  updatePostSchedule(scheduleId: number, updates: Partial<PostSchedule>): Promise<PostSchedule>;
  deletePostSchedule(scheduleId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    try {
      // Build conditions array to include soft delete filtering
      const conditions = [eq(users.id, id)];
      
      // Guard optional schema fields - filter soft-deleted users
      if ('isDeleted' in users) {
        conditions.push(eq((users as any).isDeleted, false));
      }
      
      const result = await db.select().from(users).where(and(...conditions)).limit(1).execute();
      const [user] = result;
      return user ?? undefined;
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting user:', { error: (error as Error).message });
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      // Guard optional schema fields - using db query pattern
      let query = db.select().from(users);
      if ('isDeleted' in users) {
        query = query.where(eq((users as any).isDeleted, false)) as any;
      }
      if ('createdAt' in users) {
        query = query.orderBy(desc((users as any).createdAt)) as any;
      }
      const allUsers = await query.execute();
      return allUsers;
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting all users:', { error: (error as Error).message });
      return [];
    }
  }

  async getUserByUsername(username: string, verified?: boolean): Promise<User | undefined> {
    try {
      // Build conditions array to avoid boolean leaks
      const conditions = [
        eq(users.username, username)
      ];

      // Guard optional schema fields - filter soft-deleted users
      if ('isDeleted' in users) {
        conditions.push(eq((users as any).isDeleted, false));
      }

      // Only add emailVerified condition if explicitly provided
      if (verified !== undefined) {
        conditions.push(eq(users.emailVerified, verified));
      }

      const result = await db.select().from(users).where(and(...conditions)).limit(1).execute();
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting user by username:', { error: (error as Error).message });
      return undefined;
    }
  }

  async getUserByEmail(email: string, verified?: boolean): Promise<User | undefined> {
    try {
      // Build conditions array to avoid boolean leaks
      const conditions = [
        eq(users.email, email)
      ];

      // Guard optional schema fields - filter soft-deleted users
      if ('isDeleted' in users) {
        conditions.push(eq((users as any).isDeleted, false));
      }

      // Only add emailVerified condition if explicitly provided
      if (verified !== undefined) {
        conditions.push(eq(users.emailVerified, verified));
      }

      const result = await db.select().from(users).where(and(...conditions)).limit(1).execute();
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting user by email:', { error: (error as Error).message });
      return undefined;
    }
  }

  async getUserByProviderId(provider: string, providerId: string): Promise<User | undefined> {
    try {
      const conditions = [
        eq(users.provider, provider),
        eq(users.providerId, providerId)
      ];

      // Guard optional schema fields - filter soft-deleted users
      if ('isDeleted' in users) {
        conditions.push(eq((users as any).isDeleted, false));
      }

      const result = await db.select().from(users).where(and(...conditions)).limit(1).execute();
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting user by provider ID:', { error: (error as Error).message });
      return undefined;
    }
  }

  async createUser(userData: InsertUser): Promise<User> {
    try {
      const result = await db
        .insert(users)
        .values(userData as typeof users.$inferInsert)
        .returning()
        .execute();
      const user = result[0];
      return user;
    } catch (error) {
      safeLog('error', 'Storage operation failed - creating user:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async updateUserTier(userId: number, tier: string): Promise<void> {
    try {
      await db.update(users).set({ tier }).where(eq(users.id, userId)).execute();
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating user tier:', { error: (error as Error).message });
      throw error;
    }
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    try {
      // Filter out undefined values and ensure we have something to update
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      // If no valid updates, return the existing user
      if (Object.keys(cleanUpdates).length === 0) {
        const user = await this.getUser(userId);
        if (!user) {
          throw new Error('User not found');
        }
        return user;
      }

      const result = await db.update(users).set(cleanUpdates).where(eq(users.id, userId)).returning();
      if (!result[0]) {
        throw new Error('User not found');
      }
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating user:', { error: (error as Error).message });
      throw error;
    }
  }

  async updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined> {
    try {
      const result = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating user profile:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    try {
      await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating user password:', { error: (error as Error).message });
      throw error;
    }
  }

  async updateUserEmailVerified(userId: number, verified: boolean): Promise<void> {
    try {
      await db.update(users).set({ emailVerified: verified }).where(eq(users.id, userId));
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating email verification:', { error: (error as Error).message });
      throw error;
    }
  }

  async createVerificationToken(tokenData: InsertVerificationToken): Promise<VerificationToken> {
    try {
      const [token] = await db
        .insert(verificationTokens)
        .values(tokenData as typeof verificationTokens.$inferInsert)
        .returning()
        .execute();
      return token;
    } catch (error) {
      safeLog('error', 'Storage operation failed - creating verification token:', { error: (error as Error).message });
      throw error;
    }
  }

  async getVerificationToken(token: string): Promise<VerificationToken | undefined> {
    try {
      const result = await db
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.token, token))
        .limit(1);
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting verification token:', { error: (error as Error).message });
      return undefined;
    }
  }

  async deleteVerificationToken(token: string): Promise<void> {
    try {
      await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
    } catch (error) {
      safeLog('error', 'Storage operation failed - deleting verification token:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      // if you have a soft-delete field, prefer:
      // return db.update(users).set({ deleted: true, deletedAt: new Date() }).where(eq(users.id, userId));
      await db.delete(users).where(eq(users.id, userId));
    } catch (error) {
      safeLog('error', 'Storage operation failed - deleting user:', { error: (error as Error).message });
      throw error;
    }
  }

  // Generation operations
  async createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    try {
      const genData: typeof contentGenerations.$inferInsert = {
        ...(gen as typeof contentGenerations.$inferInsert),
        titles: (gen as { titles: string[] }).titles
      };
      const result = await db
        .insert(contentGenerations)
        .values([genData])
        .returning()
        .execute();
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - creating generation:', { error: (error as Error).message });
      throw error;
    }
  }

  async getGenerationsByUserId(userId: number): Promise<ContentGeneration[]> {
    try {
      return await db.select().from(contentGenerations)
        .where(eq(contentGenerations.userId, userId))
        .orderBy(desc(contentGenerations.createdAt))
        .execute();
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting generations by user ID:', { error: (error as Error).message });
      return [];
    }
  }

  async createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration> {
    return this.createGeneration(gen);
  }

  async getUserContentGenerations(userId: number): Promise<ContentGeneration[]> {
    return this.getGenerationsByUserId(userId);
  }

  async getContentGenerationCount(): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentGenerations);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting content generation count:', { error: (error as Error).message });
      return 0;
    }
  }

  async getRevenue(): Promise<number> {
    try {
      const result = await db
        .select({ total: sql<number>`COALESCE(SUM(amount_cents), 0)` })
        .from(invoices)
        .where(eq(invoices.status, 'paid'));

      // Convert cents to dollars
      const totalCents = result[0]?.total || 0;
      return Math.round(totalCents / 100);
    } catch (error) {
      console.error('Error getting revenue:', { error: (error as Error).message });
      return 0;
    }
  }

  async getContentGenerationStats(userId: number): Promise<{ total: number; thisWeek: number; thisMonth: number; totalGenerations?: number; dailyStreak?: number }> {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [totalResult, weekResult, monthResult, dailyStreak] = await Promise.all([
        db.select({ count: count() }).from(contentGenerations).where(eq(contentGenerations.userId, userId)),
        db.select({ count: count() }).from(contentGenerations)
          .where(and(eq(contentGenerations.userId, userId), gte(contentGenerations.createdAt, oneWeekAgo))),
        db.select({ count: count() }).from(contentGenerations)
          .where(and(eq(contentGenerations.userId, userId), gte(contentGenerations.createdAt, oneMonthAgo))),
        this.calculateDailyStreak(userId)
      ]);

      return {
        total: totalResult[0]?.count || 0,
        thisWeek: weekResult[0]?.count || 0,
        thisMonth: monthResult[0]?.count || 0,
        totalGenerations: totalResult[0]?.count || 0,
        dailyStreak: dailyStreak
      };
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting content generation stats:', { error: (error as Error).message });
      return { total: 0, thisWeek: 0, thisMonth: 0, dailyStreak: 0 };
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
      safeLog('error', 'Storage operation failed - getting last generated:', { error: (error as Error).message });
      return undefined;
    }
  }

  async calculateDailyStreak(userId: number): Promise<number> {
    try {
      // Get all generations for this user ordered by date (most recent first)
      const generations = await db.select({ createdAt: contentGenerations.createdAt })
        .from(contentGenerations)
        .where(eq(contentGenerations.userId, userId))
        .orderBy(desc(contentGenerations.createdAt));

      if (generations.length === 0) {
        return 0;
      }

      // Group generations by date (ignoring time)
      const generationsByDate = new Map<string, boolean>();
      for (const gen of generations) {
        const date = gen.createdAt ? gen.createdAt.toISOString().split('T')[0] : null;
        if (date) {
          generationsByDate.set(date, true);
        }
      }

      let streak = 0;
      let currentDate = new Date();

      // Check if user generated content today or yesterday to start streak
      const todayKey = currentDate.toISOString().split('T')[0];
      const yesterdayKey = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // If no activity today or yesterday, streak is 0
      if (!generationsByDate.has(todayKey) && !generationsByDate.has(yesterdayKey)) {
        return 0;
      }

      // Start checking from yesterday if no activity today, otherwise from today
      if (!generationsByDate.has(todayKey)) {
        currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      }

      // Count consecutive days with activity
      while (true) {
        const dateKey = currentDate.toISOString().split('T')[0];
        if (generationsByDate.has(dateKey)) {
          streak++;
          // Go back one day
          currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      safeLog('error', 'Storage operation failed - calculating daily streak:', { error: (error as Error).message });
      return 0;
    }
  }


  // Preference operations
  async getUserPreferences(userId: number): Promise<UserPreference | undefined> {
    try {
      const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting user preferences:', { error: (error as Error).message });
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
        .returning()
        .execute();
      return insertResult[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating user preferences:', { error: (error as Error).message });
      throw error;
    }
  }

  // Image operations
  async createUserImage(image: InsertUserImage): Promise<UserImage> {
    try {
      const result = await db
        .insert(userImages)
        .values(image as typeof userImages.$inferInsert)
        .returning()
        .execute();
      return result[0];
    } catch (error) {
      safeLog('error', 'Storage operation failed - creating user image:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserImages(userId: number): Promise<UserImage[]> {
    try {
      return await db.select().from(userImages)
        .where(eq(userImages.userId, userId))
        .orderBy(desc(userImages.createdAt));
    } catch (error) {
      safeLog('error', 'Storage operation failed - getting user images:', { error: (error as Error).message });
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
      safeLog('error', 'Storage operation failed - getting user image:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updateUserImage(imageId: number, userId: number, updates: Partial<UserImage>): Promise<UserImage> {
    try {
      const [image] = await db.update(userImages)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)))
        .returning();
      return image;
    } catch (error) {
      safeLog('error', 'Storage operation failed - updating user image:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteUserImage(imageId: number, userId: number): Promise<void> {
    try {
      await db.delete(userImages).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)));
    } catch (error) {
      safeLog('error', 'Storage operation failed - deleting user image:', { error: (error as Error).message });
      throw error;
    }
  }


  // Admin operations
  async getTotalUserCount(): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(users);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting total user count:', { error: (error as Error).message });
      return 0;
    }
  }

  async getActiveUserCount(): Promise<number> {
    try {
      // Users who have generated content in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await db
        .selectDistinct({ userId: contentGenerations.userId })
        .from(contentGenerations)
        .where(gte(contentGenerations.createdAt, sevenDaysAgo));

      return result.length;
    } catch (error) {
      console.error('Error getting active user count:', { error: (error as Error).message });
      return 0;
    }
  }

  async getTotalContentGenerated(): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(contentGenerations);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting total content generated:', { error: (error as Error).message });
      return 0;
    }
  }

  async getSubscriptionCounts(): Promise<{ free: number; starter: number; pro: number; }> {
    try {
      const allUsers = await this.getAllUsers();
      const counts = { free: 0, starter: 0, pro: 0 };

      for (const user of allUsers) {
        const tier = user.tier || 'free';
        if (tier === 'free') counts.free++;
        else if (tier === 'starter') counts.starter++;
        else if (tier === 'pro') counts.pro++;
        else counts.free++; // Default to free if tier is unknown
      }

      return counts;
    } catch (error) {
      console.error('Error getting subscription counts:', { error: (error as Error).message });
      return { free: 0, starter: 0, pro: 0 };
    }
  }

  // Get daily generation count for a user
  async getDailyGenerationCount(userId: number): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

      const result = await db
        .select({ count: count() })
        .from(contentGenerations)
        .where(
          and(
            eq(contentGenerations.userId, userId),
            gte(contentGenerations.createdAt, today),
            sql`${contentGenerations.createdAt} < ${tomorrow}`
          )
        );

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting daily generation count:', { error: (error as Error).message });
      return 0;
    }
  }

  // Expense Category operations
  async createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> {
    try {
      const [result] = await db
        .insert(expenseCategories)
        .values(category as typeof expenseCategories.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating expense category:', { error: (error as Error).message });
      throw error;
    }
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    try {
      return await db.select().from(expenseCategories)
        .where(eq(expenseCategories.isActive, true))
        .orderBy(expenseCategories.sortOrder, expenseCategories.name);
    } catch (error) {
      console.error('Error getting expense categories:', { error: (error as Error).message });
      return [];
    }
  }

  async getExpenseCategory(id: number): Promise<ExpenseCategory | undefined> {
    try {
      const [result] = await db.select().from(expenseCategories)
        .where(eq(expenseCategories.id, id));
      return result;
    } catch (error) {
      console.error('Error getting expense category:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updateExpenseCategory(id: number, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    try {
      const [result] = await db.update(expenseCategories)
        .set(updates)
        .where(eq(expenseCategories.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating expense category:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteExpenseCategory(id: number): Promise<void> {
    try {
      await db.update(expenseCategories)
        .set({ isActive: false })
        .where(eq(expenseCategories.id, id));
    } catch (error) {
      console.error('Error deleting expense category:', { error: (error as Error).message });
      throw error;
    }
  }

  // Expense operations
  async createExpense(expense: InsertExpense): Promise<Expense> {
    try {
      const [result] = await db
        .insert(expenses)
        .values(expense as typeof expenses.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating expense:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserExpenses(
    userId: number,
    taxYear?: number
  ): Promise<Array<Expense & { category: ExpenseCategory | null }>> {
    try {
      const query = db.select({
        expense: expenses,
        category: expenseCategories
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        taxYear 
          ? and(eq(expenses.userId, userId), eq(expenses.taxYear, taxYear))
          : eq(expenses.userId, userId)
      );

      const results = await query.orderBy(desc(expenses.expenseDate));
      const flattenedResults: Array<Expense & { category: ExpenseCategory | null }> =
        results.map(({ expense, category }) => ({
          ...expense,
          category,
        }));

      return flattenedResults;
    } catch (error) {
      console.error('Error getting user expenses:', { error: (error as Error).message });
      return [];
    }
  }

  async getExpense(id: number, userId: number): Promise<Expense | undefined> {
    try {
      const [result] = await db.select().from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
      return result;
    } catch (error) {
      console.error('Error getting expense:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updateExpense(id: number, userId: number, updates: Partial<Expense>): Promise<Expense> {
    try {
      let updatesToApply: Partial<Expense> = { ...updates };
      const businessPurposeValue = updates.businessPurpose;
      const hasEmptyBusinessPurpose =
        typeof businessPurposeValue === 'string' && businessPurposeValue.trim().length === 0;

      if (hasEmptyBusinessPurpose) {
        delete updatesToApply.businessPurpose;
      }

      const needsExistingExpenseLookup = updates.categoryId !== undefined || hasEmptyBusinessPurpose;
      let existingExpense: Expense | undefined;
      if (needsExistingExpenseLookup) {
        existingExpense = await this.getExpense(id, userId);
      }

      if (updates.categoryId !== undefined) {
        const categoryChanged = existingExpense ? existingExpense.categoryId !== updates.categoryId : true;
        const category = await this.getExpenseCategory(updates.categoryId);

        if (category) {
          const categoryDefaults: ExpenseCategoryWithDefaults = category;

          if (categoryChanged) {
            updatesToApply = {
              ...updatesToApply,
              deductionPercentage: category.deductionPercentage,
            };

            const shouldApplyDefaultBusinessPurpose =
              (businessPurposeValue === undefined ||
                (typeof businessPurposeValue === 'string' && businessPurposeValue.trim().length === 0)) &&
              businessPurposeValue !== null;

            if (shouldApplyDefaultBusinessPurpose && categoryDefaults.defaultBusinessPurpose) {
              updatesToApply = {
                ...updatesToApply,
                businessPurpose: categoryDefaults.defaultBusinessPurpose,
              };
            }
          }

          if (hasEmptyBusinessPurpose && categoryDefaults.defaultBusinessPurpose) {
            updatesToApply = {
              ...updatesToApply,
              businessPurpose: categoryDefaults.defaultBusinessPurpose,
            };
          }
        }
      } else if (hasEmptyBusinessPurpose && existingExpense?.categoryId !== undefined) {
        const category = await this.getExpenseCategory(existingExpense.categoryId);
        if (category?.defaultBusinessPurpose) {
          updatesToApply = {
            ...updatesToApply,
            businessPurpose: category.defaultBusinessPurpose,
          };
        }
      }

      const [result] = await db.update(expenses)
        .set({ ...updatesToApply, updatedAt: new Date() })
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating expense:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteExpense(id: number, userId: number): Promise<void> {
    try {
      await db.delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    } catch (error) {
      console.error('Error deleting expense:', { error: (error as Error).message });
      throw error;
    }
  }

  async getExpensesByCategory(userId: number, categoryId: number, taxYear?: number): Promise<Expense[]> {
    try {
      const conditions = [
        eq(expenses.userId, userId),
        eq(expenses.categoryId, categoryId)
      ];

      if (taxYear) {
        conditions.push(eq(expenses.taxYear, taxYear));
      }

      return await db.select().from(expenses)
        .where(and(...conditions))
        .orderBy(desc(expenses.expenseDate));
    } catch (error) {
      console.error('Error getting expenses by category:', { error: (error as Error).message });
      return [];
    }
  }

  async getExpensesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Expense[]> {
    try {
      return await db.select().from(expenses)
        .where(and(
          eq(expenses.userId, userId),
          gte(expenses.expenseDate, startDate),
          sql`${expenses.expenseDate} <= ${endDate}`
        ))
        .orderBy(desc(expenses.expenseDate));
    } catch (error) {
      console.error('Error getting expenses by date range:', { error: (error as Error).message });
      return [];
    }
  }

  async getExpenseTotals(userId: number, taxYear?: number): Promise<{ total: number; deductible: number; byCategory: { [key: string]: number } }> {
    try {
      const query = db.select({
        categoryName: expenseCategories.name,
        amount: expenses.amount,
        deductionPercentage: expenses.deductionPercentage
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(
        taxYear 
          ? and(eq(expenses.userId, userId), eq(expenses.taxYear, taxYear))
          : eq(expenses.userId, userId)
      );

      const results = await query;

      return summarizeExpenseTotals(results);
    } catch (error) {
      console.error('Error getting expense totals:', { error: (error as Error).message });
      return { total: 0, deductible: 0, byCategory: {} };
    }
  }

  // Tax deduction info operations
  async getTaxDeductionInfo(): Promise<TaxDeductionInfo[]> {
    try {
      return await db.select().from(taxDeductionInfo)
        .orderBy(taxDeductionInfo.category, taxDeductionInfo.title);
    } catch (error) {
      console.error('Error getting tax deduction info:', { error: (error as Error).message });
      return [];
    }
  }

  async getTaxDeductionInfoByCategory(category: string): Promise<TaxDeductionInfo[]> {
    try {
      return await db.select().from(taxDeductionInfo)
        .where(eq(taxDeductionInfo.category, category))
        .orderBy(taxDeductionInfo.title);
    } catch (error) {
      console.error('Error getting tax deduction info by category:', { error: (error as Error).message });
      return [];
    }
  }

  async createTaxDeductionInfo(info: InsertTaxDeductionInfo): Promise<TaxDeductionInfo> {
    try {
      const [result] = await db
        .insert(taxDeductionInfo)
        .values(info as typeof taxDeductionInfo.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating tax deduction info:', { error: (error as Error).message });
      throw error;
    }
  }

  // Saved content operations
  async createSavedContent(content: InsertSavedContent): Promise<SavedContent> {
    try {
      const [result] = await db
        .insert(savedContent)
        .values(content as typeof savedContent.$inferInsert)
        .returning();
      return result;
    } catch (error) {
      safeLog('error', 'Failed to create saved content record', {
        error: (error as Error).message,
        userId: (content as any).userId ?? 'unknown',
      });
      throw error;
    }
  }

  async getSavedContentById(id: number, userId: number): Promise<SavedContent | undefined> {
    try {
      const [result] = await db
        .select()
        .from(savedContent)
        .where(and(eq(savedContent.id, id), eq(savedContent.userId, userId)))
        .limit(1);
      return result;
    } catch (error) {
      safeLog('error', 'Failed to load saved content record', {
        error: (error as Error).message,
        id,
        userId,
      });
      return undefined;
    }
  }

  async getUserSavedContent(userId: number): Promise<SavedContent[]> {
    try {
      return await db
        .select()
        .from(savedContent)
        .where(eq(savedContent.userId, userId))
        .orderBy(desc(savedContent.createdAt));
    } catch (error) {
      safeLog('error', 'Failed to list saved content records for user', {
        error: (error as Error).message,
        userId,
      });
      return [];
    }
  }

  async deleteSavedContent(id: number, userId: number): Promise<void> {
    try {
      await db
        .delete(savedContent)
        .where(and(eq(savedContent.id, id), eq(savedContent.userId, userId)));
    } catch (error) {
      safeLog('error', 'Failed to delete saved content record', {
        error: (error as Error).message,
        id,
        userId,
      });
      throw error;
    }
  }

  // Social Media operations
  async createSocialMediaAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount> {
    try {
      const [result] = await db
        .insert(socialMediaAccounts)
        .values(account as typeof socialMediaAccounts.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating social media account:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserSocialMediaAccounts(userId: number): Promise<SocialMediaAccount[]> {
    try {
      return await db.select().from(socialMediaAccounts)
        .where(eq(socialMediaAccounts.userId, userId))
        .orderBy(desc(socialMediaAccounts.createdAt));
    } catch (error) {
      console.error('Error getting user social media accounts:', { error: (error as Error).message });
      return [];
    }
  }

  async getSocialMediaAccount(accountId: number): Promise<SocialMediaAccount | undefined> {
    try {
      const [result] = await db.select().from(socialMediaAccounts)
        .where(eq(socialMediaAccounts.id, accountId))
        .limit(1);
      return result;
    } catch (error) {
      console.error('Error getting social media account:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updateSocialMediaAccount(accountId: number, updates: Partial<SocialMediaAccount>): Promise<SocialMediaAccount> {
    try {
      const [result] = await db.update(socialMediaAccounts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(socialMediaAccounts.id, accountId))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating social media account:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteSocialMediaAccount(accountId: number): Promise<void> {
    try {
      await db.delete(socialMediaAccounts).where(eq(socialMediaAccounts.id, accountId));
    } catch (error) {
      console.error('Error deleting social media account:', { error: (error as Error).message });
      throw error;
    }
  }

  async createSocialMediaPost(post: InsertSocialMediaPost): Promise<SocialMediaPost> {
    try {
      const [result] = await db
        .insert(socialMediaPosts)
        .values(post as typeof socialMediaPosts.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating social media post:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserSocialMediaPosts(
    userId: number, 
    filters?: { platform?: string; status?: string; limit?: number; offset?: number }
  ): Promise<SocialMediaPost[]> {
    try {
      const { platform, status, limit = 50, offset = 0 } = filters || {};

      // Build conditions array
      const conditions = [eq(socialMediaPosts.userId, userId)];

      if (platform) {
        conditions.push(eq(socialMediaPosts.platform, platform));
      }

      if (status) {
        conditions.push(eq(socialMediaPosts.status, status));
      }

      return await db.select().from(socialMediaPosts)
        .where(and(...conditions))
        .orderBy(desc(socialMediaPosts.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting user social media posts:', { error: (error as Error).message });
      return [];
    }
  }

  async getSocialMediaPost(postId: number): Promise<SocialMediaPost | undefined> {
    try {
      const [result] = await db.select().from(socialMediaPosts)
        .where(eq(socialMediaPosts.id, postId))
        .limit(1);
      return result;
    } catch (error) {
      console.error('Error getting social media post:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updateSocialMediaPost(postId: number, updates: Partial<SocialMediaPost>): Promise<SocialMediaPost> {
    try {
      const [result] = await db.update(socialMediaPosts)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(socialMediaPosts.id, postId))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating social media post:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteSocialMediaPost(postId: number): Promise<void> {
    try {
      await db.delete(socialMediaPosts).where(eq(socialMediaPosts.id, postId));
    } catch (error) {
      console.error('Error deleting social media post:', { error: (error as Error).message });
      throw error;
    }
  }

  async createPlatformEngagement(engagement: InsertPlatformEngagement): Promise<PlatformEngagement> {
    try {
      const [result] = await db
        .insert(platformEngagement)
        .values(engagement as typeof platformEngagement.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating platform engagement:', { error: (error as Error).message });
      throw error;
    }
  }

  async getPlatformEngagement(accountId: number, date?: Date): Promise<PlatformEngagement[]> {
    try {
      // Build conditions array
      const conditions = [eq(platformEngagement.accountId, accountId)];

      if (date) {
        conditions.push(eq(platformEngagement.date, date));
      }

      return await db.select().from(platformEngagement)
        .where(and(...conditions))
        .orderBy(desc(platformEngagement.date));
    } catch (error) {
      console.error('Error getting platform engagement:', { error: (error as Error).message });
      return [];
    }
  }

  async createPostSchedule(schedule: InsertPostSchedule): Promise<PostSchedule> {
    try {
      const [result] = await db
        .insert(postSchedule)
        .values(schedule as typeof postSchedule.$inferInsert)
        .returning()
        .execute();
      return result;
    } catch (error) {
      console.error('Error creating post schedule:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserScheduledPosts(userId: number): Promise<PostSchedule[]> {
    try {
      return await db.select().from(postSchedule)
        .where(eq(postSchedule.userId, userId))
        .orderBy(desc(postSchedule.scheduledTime));
    } catch (error) {
      console.error('Error getting user scheduled posts:', { error: (error as Error).message });
      return [];
    }
  }

  async getPostSchedule(scheduleId: number): Promise<PostSchedule | undefined> {
    try {
      const [result] = await db.select().from(postSchedule)
        .where(eq(postSchedule.id, scheduleId))
        .limit(1);
      return result;
    } catch (error) {
      console.error('Error getting post schedule:', { error: (error as Error).message });
      return undefined;
    }
  }

  async updatePostSchedule(scheduleId: number, updates: Partial<PostSchedule>): Promise<PostSchedule> {
    try {
      const [result] = await db.update(postSchedule)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(postSchedule.id, scheduleId))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating post schedule:', { error: (error as Error).message });
      throw error;
    }
  }

  async deletePostSchedule(scheduleId: number): Promise<void> {
    try {
      await db.delete(postSchedule).where(eq(postSchedule.id, scheduleId));
    } catch (error) {
      console.error('Error deleting post schedule:', { error: (error as Error).message });
      throw error;
    }
  }
}

// Create and export the storage instance
export const storage = new DatabaseStorage();