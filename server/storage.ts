
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
  users,
  contentGenerations,
  userSamples,
  userPreferences,
  userImages,
  expenseCategories,
  expenses,
  taxDeductionInfo,
  socialMediaAccounts,
  socialMediaPosts,
  platformEngagement,
  postSchedule
} from "@shared/schema";
import { db } from "./db.js";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserTier(userId: number, tier: string): Promise<void>;
  updateUser(userId: number, updates: Partial<User>): Promise<User>;
  updateUserProfile(userId: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  updateUserEmailVerified(userId: number, verified: boolean): Promise<void>;
  deleteUser(userId: number): Promise<void>;

  // Generation operations
  createGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getGenerationsByUserId(userId: number): Promise<ContentGeneration[]>;
  createContentGeneration(gen: InsertContentGeneration): Promise<ContentGeneration>;
  getUserContentGenerations(userId: number): Promise<ContentGeneration[]>;
  getContentGenerationCount(): Promise<number>;
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
  
  // Streak operations
  calculateDailyStreak(userId: number): Promise<number>;

  // Admin operations
  getTotalUserCount(): Promise<number>;
  getActiveUserCount(): Promise<number>;
  getTotalContentGenerated(): Promise<number>;
  getSubscriptionCounts(): Promise<{ free: number; pro: number; premium: number; }>;
  
  // Generation limit operations
  getDailyGenerationCount(userId: number): Promise<number>;
  
  // Expense operations
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: number): Promise<ExpenseCategory | undefined>;
  updateExpenseCategory(id: number, updates: Partial<ExpenseCategory>): Promise<ExpenseCategory>;
  deleteExpenseCategory(id: number): Promise<void>;
  
  createExpense(expense: InsertExpense): Promise<Expense>;
  getUserExpenses(userId: number, taxYear?: number): Promise<Expense[]>;
  getExpense(id: number, userId: number): Promise<Expense | undefined>;
  updateExpense(id: number, userId: number, updates: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: number, userId: number): Promise<void>;
  getExpensesByCategory(userId: number, categoryId: number, taxYear?: number): Promise<Expense[]>;
  getExpensesByDateRange(userId: number, startDate: Date, endDate: Date): Promise<Expense[]>;
  getExpenseTotals(userId: number, taxYear?: number): Promise<{ total: number; deductible: number; byCategory: { [key: string]: number } }>;
  
  getTaxDeductionInfo(): Promise<TaxDeductionInfo[]>;
  getTaxDeductionInfoByCategory(category: string): Promise<TaxDeductionInfo[]>;
  createTaxDeductionInfo(info: InsertTaxDeductionInfo): Promise<TaxDeductionInfo>;

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
  
  createPlatformEngagement(engagement: InsertPlatformEngagement): Promise<PlatformEngagement>;
  getPlatformEngagement(accountId: number, date?: Date): Promise<PlatformEngagement[]>;
  
  createPostSchedule(schedule: InsertPostSchedule): Promise<PostSchedule>;
  getUserScheduledPosts(userId: number): Promise<PostSchedule[]>;
  getPostSchedule(scheduleId: number): Promise<PostSchedule | undefined>;
  updatePostSchedule(scheduleId: number, updates: Partial<PostSchedule>): Promise<PostSchedule>;
  deletePostSchedule(scheduleId: number): Promise<void>;
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
      const allUsers = await db.select().from(users);
      
      // Remove duplicates based on username (keep the most recent one)
      const uniqueUsers = allUsers.reduce((acc, user) => {
        const existing = acc.find(u => u.username === user.username);
        if (!existing) {
          acc.push(user);
        } else if (user.createdAt && existing.createdAt && new Date(user.createdAt) > new Date(existing.createdAt)) {
          // Replace with newer user if timestamps exist
          const index = acc.findIndex(u => u.username === user.username);
          acc[index] = user;
        }
        return acc;
      }, [] as User[]);
      
      return uniqueUsers;
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

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    try {
      const result = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
      if (!result[0]) {
        throw new Error('User not found');
      }
      return result[0];
    } catch (error) {
      console.error('Storage: Error updating user:', error);
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
      // Ensure proper typing for database insertion
      const genData = {
        ...gen,
        titles: gen.titles as string[]
      };
      const result = await db.insert(contentGenerations).values([genData]).returning();
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

  async getContentGenerationCount(): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(contentGenerations);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting content generation count:', error);
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
      console.error('Storage: Error getting content generation stats:', error);
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
      console.error('Storage: Error getting last generated:', error);
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

      const today = new Date().toISOString().split('T')[0];
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
      console.error('Storage: Error calculating daily streak:', error);
      return 0;
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


  // Admin operations
  async getTotalUserCount(): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(users);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting total user count:', error);
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
      console.error('Error getting active user count:', error);
      return 0;
    }
  }

  async getTotalContentGenerated(): Promise<number> {
    try {
      const result = await db.select({ count: count() }).from(contentGenerations);
      return result[0]?.count || 0;
    } catch (error) {
      console.error('Error getting total content generated:', error);
      return 0;
    }
  }

  async getSubscriptionCounts(): Promise<{ free: number; pro: number; premium: number; }> {
    try {
      const allUsers = await this.getAllUsers();
      const counts = { free: 0, pro: 0, premium: 0 };
      
      for (const user of allUsers) {
        const tier = user.tier || 'free';
        if (tier in counts) {
          (counts as any)[tier]++;
        } else {
          counts.free++; // Default to free if tier is unknown
        }
      }
      
      return counts;
    } catch (error) {
      console.error('Error getting subscription counts:', error);
      return { free: 0, pro: 0, premium: 0 };
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
      console.error('Error getting daily generation count:', error);
      return 0;
    }
  }

  // Expense Category operations
  async createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> {
    try {
      const [result] = await db.insert(expenseCategories).values(category).returning();
      return result;
    } catch (error) {
      console.error('Error creating expense category:', error);
      throw error;
    }
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    try {
      return await db.select().from(expenseCategories)
        .where(eq(expenseCategories.isActive, true))
        .orderBy(expenseCategories.sortOrder, expenseCategories.name);
    } catch (error) {
      console.error('Error getting expense categories:', error);
      return [];
    }
  }

  async getExpenseCategory(id: number): Promise<ExpenseCategory | undefined> {
    try {
      const [result] = await db.select().from(expenseCategories)
        .where(eq(expenseCategories.id, id));
      return result;
    } catch (error) {
      console.error('Error getting expense category:', error);
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
      console.error('Error updating expense category:', error);
      throw error;
    }
  }

  async deleteExpenseCategory(id: number): Promise<void> {
    try {
      await db.update(expenseCategories)
        .set({ isActive: false })
        .where(eq(expenseCategories.id, id));
    } catch (error) {
      console.error('Error deleting expense category:', error);
      throw error;
    }
  }

  // Expense operations
  async createExpense(expense: InsertExpense): Promise<Expense> {
    try {
      const [result] = await db.insert(expenses).values(expense).returning();
      return result;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  }

  async getUserExpenses(userId: number, taxYear?: number): Promise<Expense[]> {
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
      return results.map(r => ({
        ...r.expense,
        category: r.category
      })) as any;
    } catch (error) {
      console.error('Error getting user expenses:', error);
      return [];
    }
  }

  async getExpense(id: number, userId: number): Promise<Expense | undefined> {
    try {
      const [result] = await db.select().from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
      return result;
    } catch (error) {
      console.error('Error getting expense:', error);
      return undefined;
    }
  }

  async updateExpense(id: number, userId: number, updates: Partial<Expense>): Promise<Expense> {
    try {
      const [result] = await db.update(expenses)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  }

  async deleteExpense(id: number, userId: number): Promise<void> {
    try {
      await db.delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    } catch (error) {
      console.error('Error deleting expense:', error);
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
      console.error('Error getting expenses by category:', error);
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
      console.error('Error getting expenses by date range:', error);
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
      
      let total = 0;
      let deductible = 0;
      const byCategory: { [key: string]: number } = {};

      for (const result of results) {
        const amount = result.amount;
        const deductionAmount = Math.round(amount * (result.deductionPercentage / 100));
        const categoryName = result.categoryName || 'Other';

        total += amount;
        deductible += deductionAmount;
        byCategory[categoryName] = (byCategory[categoryName] || 0) + deductionAmount;
      }

      return { total, deductible, byCategory };
    } catch (error) {
      console.error('Error getting expense totals:', error);
      return { total: 0, deductible: 0, byCategory: {} };
    }
  }

  // Tax deduction info operations
  async getTaxDeductionInfo(): Promise<TaxDeductionInfo[]> {
    try {
      return await db.select().from(taxDeductionInfo)
        .orderBy(taxDeductionInfo.category, taxDeductionInfo.title);
    } catch (error) {
      console.error('Error getting tax deduction info:', error);
      return [];
    }
  }

  async getTaxDeductionInfoByCategory(category: string): Promise<TaxDeductionInfo[]> {
    try {
      return await db.select().from(taxDeductionInfo)
        .where(eq(taxDeductionInfo.category, category))
        .orderBy(taxDeductionInfo.title);
    } catch (error) {
      console.error('Error getting tax deduction info by category:', error);
      return [];
    }
  }

  async createTaxDeductionInfo(info: InsertTaxDeductionInfo): Promise<TaxDeductionInfo> {
    try {
      const [result] = await db.insert(taxDeductionInfo).values(info).returning();
      return result;
    } catch (error) {
      console.error('Error creating tax deduction info:', error);
      throw error;
    }
  }

  // Social Media operations
  async createSocialMediaAccount(account: InsertSocialMediaAccount): Promise<SocialMediaAccount> {
    try {
      const [result] = await db.insert(socialMediaAccounts).values(account).returning();
      return result;
    } catch (error) {
      console.error('Error creating social media account:', error);
      throw error;
    }
  }

  async getUserSocialMediaAccounts(userId: number): Promise<SocialMediaAccount[]> {
    try {
      return await db.select().from(socialMediaAccounts)
        .where(eq(socialMediaAccounts.userId, userId))
        .orderBy(desc(socialMediaAccounts.createdAt));
    } catch (error) {
      console.error('Error getting user social media accounts:', error);
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
      console.error('Error getting social media account:', error);
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
      console.error('Error updating social media account:', error);
      throw error;
    }
  }

  async deleteSocialMediaAccount(accountId: number): Promise<void> {
    try {
      await db.delete(socialMediaAccounts).where(eq(socialMediaAccounts.id, accountId));
    } catch (error) {
      console.error('Error deleting social media account:', error);
      throw error;
    }
  }

  async createSocialMediaPost(post: InsertSocialMediaPost): Promise<SocialMediaPost> {
    try {
      const [result] = await db.insert(socialMediaPosts).values(post).returning();
      return result;
    } catch (error) {
      console.error('Error creating social media post:', error);
      throw error;
    }
  }

  async getUserSocialMediaPosts(
    userId: number, 
    filters?: { platform?: string; status?: string; limit?: number; offset?: number }
  ): Promise<SocialMediaPost[]> {
    try {
      const { platform, status, limit = 50, offset = 0 } = filters || {};
      
      let query = db.select().from(socialMediaPosts)
        .where(eq(socialMediaPosts.userId, userId));

      if (platform) {
        query = query.where(eq(socialMediaPosts.platform, platform));
      }
      
      if (status) {
        query = query.where(eq(socialMediaPosts.status, status));
      }

      return await query
        .orderBy(desc(socialMediaPosts.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      console.error('Error getting user social media posts:', error);
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
      console.error('Error getting social media post:', error);
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
      console.error('Error updating social media post:', error);
      throw error;
    }
  }

  async deleteSocialMediaPost(postId: number): Promise<void> {
    try {
      await db.delete(socialMediaPosts).where(eq(socialMediaPosts.id, postId));
    } catch (error) {
      console.error('Error deleting social media post:', error);
      throw error;
    }
  }

  async createPlatformEngagement(engagement: InsertPlatformEngagement): Promise<PlatformEngagement> {
    try {
      const [result] = await db.insert(platformEngagement).values(engagement).returning();
      return result;
    } catch (error) {
      console.error('Error creating platform engagement:', error);
      throw error;
    }
  }

  async getPlatformEngagement(accountId: number, date?: Date): Promise<PlatformEngagement[]> {
    try {
      let query = db.select().from(platformEngagement)
        .where(eq(platformEngagement.accountId, accountId));

      if (date) {
        query = query.where(eq(platformEngagement.date, date));
      }

      return await query.orderBy(desc(platformEngagement.date));
    } catch (error) {
      console.error('Error getting platform engagement:', error);
      return [];
    }
  }

  async createPostSchedule(schedule: InsertPostSchedule): Promise<PostSchedule> {
    try {
      const [result] = await db.insert(postSchedule).values(schedule).returning();
      return result;
    } catch (error) {
      console.error('Error creating post schedule:', error);
      throw error;
    }
  }

  async getUserScheduledPosts(userId: number): Promise<PostSchedule[]> {
    try {
      return await db.select().from(postSchedule)
        .where(eq(postSchedule.userId, userId))
        .orderBy(desc(postSchedule.scheduledTime));
    } catch (error) {
      console.error('Error getting user scheduled posts:', error);
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
      console.error('Error getting post schedule:', error);
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
      console.error('Error updating post schedule:', error);
      throw error;
    }
  }

  async deletePostSchedule(scheduleId: number): Promise<void> {
    try {
      await db.delete(postSchedule).where(eq(postSchedule.id, scheduleId));
    } catch (error) {
      console.error('Error deleting post schedule:', error);
      throw error;
    }
  }
}

// Create and export the storage instance
export const storage = new PostgreSQLStorage();
