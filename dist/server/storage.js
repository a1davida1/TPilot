import { users, contentGenerations, userSamples, userPreferences, userImages, expenseCategories, expenses, taxDeductionInfo, socialMediaAccounts, socialMediaPosts, platformEngagement, postSchedule, verificationTokens } from "@shared/schema";
import { db } from "./db.js";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { safeLog } from './lib/logger-utils.js';
class PostgreSQLStorage {
    // User operations
    async getUser(id) {
        try {
            const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
            const user = result[0];
            if (user) {
            }
            else {
            }
            return user;
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user:', { error: error.message });
            return undefined;
        }
    }
    async getAllUsers() {
        try {
            const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
            return allUsers;
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting all users:', { error: error.message });
            return [];
        }
    }
    async getUserByUsername(username) {
        try {
            const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user by username:', { error: error.message });
            return undefined;
        }
    }
    async getUserByEmail(email) {
        try {
            const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user by email:', { error: error.message });
            return undefined;
        }
    }
    async createUser(userData) {
        try {
            const result = await db.insert(users).values(userData).returning();
            const user = result[0];
            return user;
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - creating user:', { error: error.message });
            throw error;
        }
    }
    async updateUserTier(userId, tier) {
        try {
            await db.update(users).set({ tier }).where(eq(users.id, userId));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - updating user tier:', { error: error.message });
            throw error;
        }
    }
    async updateUser(userId, updates) {
        try {
            const result = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
            if (!result[0]) {
                throw new Error('User not found');
            }
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - updating user:', { error: error.message });
            throw error;
        }
    }
    async updateUserProfile(userId, updates) {
        try {
            const result = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - updating user profile:', { error: error.message });
            return undefined;
        }
    }
    async updateUserPassword(userId, hashedPassword) {
        try {
            await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - updating user password:', { error: error.message });
            throw error;
        }
    }
    async updateUserEmailVerified(userId, verified) {
        try {
            await db.update(users).set({ emailVerified: verified }).where(eq(users.id, userId));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - updating email verification:', { error: error.message });
            throw error;
        }
    }
    async createVerificationToken(tokenData) {
        try {
            const [token] = await db.insert(verificationTokens).values(tokenData).returning();
            return token;
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - creating verification token:', { error: error.message });
            throw error;
        }
    }
    async getVerificationToken(token) {
        try {
            const result = await db
                .select()
                .from(verificationTokens)
                .where(eq(verificationTokens.token, token))
                .limit(1);
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting verification token:', { error: error.message });
            return undefined;
        }
    }
    async deleteVerificationToken(token) {
        try {
            await db.delete(verificationTokens).where(eq(verificationTokens.token, token));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - deleting verification token:', { error: error.message });
            throw error;
        }
    }
    async deleteUser(userId) {
        try {
            await db.delete(users).where(eq(users.id, userId));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - deleting user:', { error: error.message });
            throw error;
        }
    }
    // Generation operations
    async createGeneration(gen) {
        try {
            // Ensure proper typing for database insertion
            const genData = {
                ...gen,
                titles: gen.titles
            };
            const result = await db.insert(contentGenerations).values([genData]).returning();
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - creating generation:', { error: error.message });
            throw error;
        }
    }
    async getGenerationsByUserId(userId) {
        try {
            return await db.select().from(contentGenerations)
                .where(eq(contentGenerations.userId, userId))
                .orderBy(desc(contentGenerations.createdAt));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting generations by user ID:', { error: error.message });
            return [];
        }
    }
    async createContentGeneration(gen) {
        return this.createGeneration(gen);
    }
    async getUserContentGenerations(userId) {
        return this.getGenerationsByUserId(userId);
    }
    async getContentGenerationCount() {
        try {
            const result = await db
                .select({ count: sql `count(*)` })
                .from(contentGenerations);
            return result[0]?.count || 0;
        }
        catch (error) {
            console.error('Error getting content generation count:', { error: error.message });
            return 0;
        }
    }
    async getContentGenerationStats(userId) {
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
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting content generation stats:', { error: error.message });
            return { total: 0, thisWeek: 0, thisMonth: 0, dailyStreak: 0 };
        }
    }
    async getLastGenerated(userId) {
        try {
            const result = await db.select().from(contentGenerations)
                .where(eq(contentGenerations.userId, userId))
                .orderBy(desc(contentGenerations.createdAt))
                .limit(1);
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting last generated:', { error: error.message });
            return undefined;
        }
    }
    async calculateDailyStreak(userId) {
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
            const generationsByDate = new Map();
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
                }
                else {
                    break;
                }
            }
            return streak;
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - calculating daily streak:', { error: error.message });
            return 0;
        }
    }
    // Sample operations
    async createUserSample(sample) {
        try {
            const result = await db.insert(userSamples).values(sample).returning();
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - creating user sample:', { error: error.message });
            throw error;
        }
    }
    async getUserSamples(userId) {
        try {
            return await db.select().from(userSamples)
                .where(eq(userSamples.userId, userId))
                .orderBy(desc(userSamples.createdAt));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user samples:', { error: error.message });
            return [];
        }
    }
    async deleteUserSample(sampleId, userId) {
        try {
            await db.delete(userSamples).where(and(eq(userSamples.id, sampleId), eq(userSamples.userId, userId)));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - deleting user sample:', { error: error.message });
            throw error;
        }
    }
    // Preference operations
    async getUserPreferences(userId) {
        try {
            const result = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user preferences:', { error: error.message });
            return undefined;
        }
    }
    async updateUserPreferences(userId, preferences) {
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
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - updating user preferences:', { error: error.message });
            throw error;
        }
    }
    // Image operations
    async createUserImage(image) {
        try {
            const result = await db.insert(userImages).values(image).returning();
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - creating user image:', { error: error.message });
            throw error;
        }
    }
    async getUserImages(userId) {
        try {
            return await db.select().from(userImages)
                .where(eq(userImages.userId, userId))
                .orderBy(desc(userImages.createdAt));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user images:', { error: error.message });
            return [];
        }
    }
    async getUserImage(imageId, userId) {
        try {
            const result = await db.select().from(userImages)
                .where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)))
                .limit(1);
            return result[0];
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - getting user image:', { error: error.message });
            return undefined;
        }
    }
    async deleteUserImage(imageId, userId) {
        try {
            await db.delete(userImages).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)));
        }
        catch (error) {
            safeLog('error', 'Storage operation failed - deleting user image:', { error: error.message });
            throw error;
        }
    }
    // Admin operations
    async getTotalUserCount() {
        try {
            const result = await db.select({ count: count() }).from(users);
            return result[0]?.count || 0;
        }
        catch (error) {
            console.error('Error getting total user count:', { error: error.message });
            return 0;
        }
    }
    async getActiveUserCount() {
        try {
            // Users who have generated content in the last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const result = await db
                .selectDistinct({ userId: contentGenerations.userId })
                .from(contentGenerations)
                .where(gte(contentGenerations.createdAt, sevenDaysAgo));
            return result.length;
        }
        catch (error) {
            console.error('Error getting active user count:', { error: error.message });
            return 0;
        }
    }
    async getTotalContentGenerated() {
        try {
            const result = await db.select({ count: count() }).from(contentGenerations);
            return result[0]?.count || 0;
        }
        catch (error) {
            console.error('Error getting total content generated:', { error: error.message });
            return 0;
        }
    }
    async getSubscriptionCounts() {
        try {
            const allUsers = await this.getAllUsers();
            const counts = { free: 0, pro: 0, premium: 0 };
            for (const user of allUsers) {
                const tier = user.tier || 'free';
                if (tier in counts) {
                    counts[tier]++;
                }
                else {
                    counts.free++; // Default to free if tier is unknown
                }
            }
            return counts;
        }
        catch (error) {
            console.error('Error getting subscription counts:', { error: error.message });
            return { free: 0, pro: 0, premium: 0 };
        }
    }
    // Get daily generation count for a user
    async getDailyGenerationCount(userId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow
            const result = await db
                .select({ count: count() })
                .from(contentGenerations)
                .where(and(eq(contentGenerations.userId, userId), gte(contentGenerations.createdAt, today), sql `${contentGenerations.createdAt} < ${tomorrow}`));
            return result[0]?.count || 0;
        }
        catch (error) {
            console.error('Error getting daily generation count:', { error: error.message });
            return 0;
        }
    }
    // Expense Category operations
    async createExpenseCategory(category) {
        try {
            const [result] = await db.insert(expenseCategories).values(category).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating expense category:', { error: error.message });
            throw error;
        }
    }
    async getExpenseCategories() {
        try {
            return await db.select().from(expenseCategories)
                .where(eq(expenseCategories.isActive, true))
                .orderBy(expenseCategories.sortOrder, expenseCategories.name);
        }
        catch (error) {
            console.error('Error getting expense categories:', { error: error.message });
            return [];
        }
    }
    async getExpenseCategory(id) {
        try {
            const [result] = await db.select().from(expenseCategories)
                .where(eq(expenseCategories.id, id));
            return result;
        }
        catch (error) {
            console.error('Error getting expense category:', { error: error.message });
            return undefined;
        }
    }
    async updateExpenseCategory(id, updates) {
        try {
            const [result] = await db.update(expenseCategories)
                .set(updates)
                .where(eq(expenseCategories.id, id))
                .returning();
            return result;
        }
        catch (error) {
            console.error('Error updating expense category:', { error: error.message });
            throw error;
        }
    }
    async deleteExpenseCategory(id) {
        try {
            await db.update(expenseCategories)
                .set({ isActive: false })
                .where(eq(expenseCategories.id, id));
        }
        catch (error) {
            console.error('Error deleting expense category:', { error: error.message });
            throw error;
        }
    }
    // Expense operations
    async createExpense(expense) {
        try {
            const [result] = await db.insert(expenses).values(expense).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating expense:', { error: error.message });
            throw error;
        }
    }
    async getUserExpenses(userId, taxYear) {
        try {
            const query = db.select({
                expense: expenses,
                category: expenseCategories
            })
                .from(expenses)
                .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
                .where(taxYear
                ? and(eq(expenses.userId, userId), eq(expenses.taxYear, taxYear))
                : eq(expenses.userId, userId));
            const results = await query.orderBy(desc(expenses.expenseDate));
            return results.map(r => ({
                ...r.expense,
                category: r.category
            }));
        }
        catch (error) {
            console.error('Error getting user expenses:', { error: error.message });
            return [];
        }
    }
    async getExpense(id, userId) {
        try {
            const [result] = await db.select().from(expenses)
                .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
            return result;
        }
        catch (error) {
            console.error('Error getting expense:', { error: error.message });
            return undefined;
        }
    }
    async updateExpense(id, userId, updates) {
        try {
            const [result] = await db.update(expenses)
                .set({ ...updates, updatedAt: new Date() })
                .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
                .returning();
            return result;
        }
        catch (error) {
            console.error('Error updating expense:', { error: error.message });
            throw error;
        }
    }
    async deleteExpense(id, userId) {
        try {
            await db.delete(expenses)
                .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
        }
        catch (error) {
            console.error('Error deleting expense:', { error: error.message });
            throw error;
        }
    }
    async getExpensesByCategory(userId, categoryId, taxYear) {
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
        }
        catch (error) {
            console.error('Error getting expenses by category:', { error: error.message });
            return [];
        }
    }
    async getExpensesByDateRange(userId, startDate, endDate) {
        try {
            return await db.select().from(expenses)
                .where(and(eq(expenses.userId, userId), gte(expenses.expenseDate, startDate), sql `${expenses.expenseDate} <= ${endDate}`))
                .orderBy(desc(expenses.expenseDate));
        }
        catch (error) {
            console.error('Error getting expenses by date range:', { error: error.message });
            return [];
        }
    }
    async getExpenseTotals(userId, taxYear) {
        try {
            const query = db.select({
                categoryName: expenseCategories.name,
                amount: expenses.amount,
                deductionPercentage: expenses.deductionPercentage
            })
                .from(expenses)
                .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
                .where(taxYear
                ? and(eq(expenses.userId, userId), eq(expenses.taxYear, taxYear))
                : eq(expenses.userId, userId));
            const results = await query;
            let total = 0;
            let deductible = 0;
            const byCategory = {};
            for (const result of results) {
                const amount = result.amount;
                const deductionAmount = Math.round(amount * (result.deductionPercentage / 100));
                const categoryName = result.categoryName || 'Other';
                total += amount;
                deductible += deductionAmount;
                byCategory[categoryName] = (byCategory[categoryName] || 0) + deductionAmount;
            }
            return { total, deductible, byCategory };
        }
        catch (error) {
            console.error('Error getting expense totals:', { error: error.message });
            return { total: 0, deductible: 0, byCategory: {} };
        }
    }
    // Tax deduction info operations
    async getTaxDeductionInfo() {
        try {
            return await db.select().from(taxDeductionInfo)
                .orderBy(taxDeductionInfo.category, taxDeductionInfo.title);
        }
        catch (error) {
            console.error('Error getting tax deduction info:', { error: error.message });
            return [];
        }
    }
    async getTaxDeductionInfoByCategory(category) {
        try {
            return await db.select().from(taxDeductionInfo)
                .where(eq(taxDeductionInfo.category, category))
                .orderBy(taxDeductionInfo.title);
        }
        catch (error) {
            console.error('Error getting tax deduction info by category:', { error: error.message });
            return [];
        }
    }
    async createTaxDeductionInfo(info) {
        try {
            const [result] = await db.insert(taxDeductionInfo).values(info).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating tax deduction info:', { error: error.message });
            throw error;
        }
    }
    // Social Media operations
    async createSocialMediaAccount(account) {
        try {
            const [result] = await db.insert(socialMediaAccounts).values(account).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating social media account:', { error: error.message });
            throw error;
        }
    }
    async getUserSocialMediaAccounts(userId) {
        try {
            return await db.select().from(socialMediaAccounts)
                .where(eq(socialMediaAccounts.userId, userId))
                .orderBy(desc(socialMediaAccounts.createdAt));
        }
        catch (error) {
            console.error('Error getting user social media accounts:', { error: error.message });
            return [];
        }
    }
    async getSocialMediaAccount(accountId) {
        try {
            const [result] = await db.select().from(socialMediaAccounts)
                .where(eq(socialMediaAccounts.id, accountId))
                .limit(1);
            return result;
        }
        catch (error) {
            console.error('Error getting social media account:', { error: error.message });
            return undefined;
        }
    }
    async updateSocialMediaAccount(accountId, updates) {
        try {
            const [result] = await db.update(socialMediaAccounts)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(socialMediaAccounts.id, accountId))
                .returning();
            return result;
        }
        catch (error) {
            console.error('Error updating social media account:', { error: error.message });
            throw error;
        }
    }
    async deleteSocialMediaAccount(accountId) {
        try {
            await db.delete(socialMediaAccounts).where(eq(socialMediaAccounts.id, accountId));
        }
        catch (error) {
            console.error('Error deleting social media account:', { error: error.message });
            throw error;
        }
    }
    async createSocialMediaPost(post) {
        try {
            const [result] = await db.insert(socialMediaPosts).values(post).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating social media post:', { error: error.message });
            throw error;
        }
    }
    async getUserSocialMediaPosts(userId, filters) {
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
        }
        catch (error) {
            console.error('Error getting user social media posts:', { error: error.message });
            return [];
        }
    }
    async getSocialMediaPost(postId) {
        try {
            const [result] = await db.select().from(socialMediaPosts)
                .where(eq(socialMediaPosts.id, postId))
                .limit(1);
            return result;
        }
        catch (error) {
            console.error('Error getting social media post:', { error: error.message });
            return undefined;
        }
    }
    async updateSocialMediaPost(postId, updates) {
        try {
            const [result] = await db.update(socialMediaPosts)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(socialMediaPosts.id, postId))
                .returning();
            return result;
        }
        catch (error) {
            console.error('Error updating social media post:', { error: error.message });
            throw error;
        }
    }
    async deleteSocialMediaPost(postId) {
        try {
            await db.delete(socialMediaPosts).where(eq(socialMediaPosts.id, postId));
        }
        catch (error) {
            console.error('Error deleting social media post:', { error: error.message });
            throw error;
        }
    }
    async createPlatformEngagement(engagement) {
        try {
            const [result] = await db.insert(platformEngagement).values(engagement).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating platform engagement:', { error: error.message });
            throw error;
        }
    }
    async getPlatformEngagement(accountId, date) {
        try {
            // Build conditions array
            const conditions = [eq(platformEngagement.accountId, accountId)];
            if (date) {
                conditions.push(eq(platformEngagement.date, date));
            }
            return await db.select().from(platformEngagement)
                .where(and(...conditions))
                .orderBy(desc(platformEngagement.date));
        }
        catch (error) {
            console.error('Error getting platform engagement:', { error: error.message });
            return [];
        }
    }
    async createPostSchedule(schedule) {
        try {
            const [result] = await db.insert(postSchedule).values(schedule).returning();
            return result;
        }
        catch (error) {
            console.error('Error creating post schedule:', { error: error.message });
            throw error;
        }
    }
    async getUserScheduledPosts(userId) {
        try {
            return await db.select().from(postSchedule)
                .where(eq(postSchedule.userId, userId))
                .orderBy(desc(postSchedule.scheduledTime));
        }
        catch (error) {
            console.error('Error getting user scheduled posts:', { error: error.message });
            return [];
        }
    }
    async getPostSchedule(scheduleId) {
        try {
            const [result] = await db.select().from(postSchedule)
                .where(eq(postSchedule.id, scheduleId))
                .limit(1);
            return result;
        }
        catch (error) {
            console.error('Error getting post schedule:', { error: error.message });
            return undefined;
        }
    }
    async updatePostSchedule(scheduleId, updates) {
        try {
            const [result] = await db.update(postSchedule)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(postSchedule.id, scheduleId))
                .returning();
            return result;
        }
        catch (error) {
            console.error('Error updating post schedule:', { error: error.message });
            throw error;
        }
    }
    async deletePostSchedule(scheduleId) {
        try {
            await db.delete(postSchedule).where(eq(postSchedule.id, scheduleId));
        }
        catch (error) {
            console.error('Error deleting post schedule:', { error: error.message });
            throw error;
        }
    }
}
// Create and export the storage instance
export const storage = new PostgreSQLStorage();
