import { users, contentGenerations, userSamples, userPreferences, userImages } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, desc, and, gte, count } from "drizzle-orm";
class PostgreSQLStorage {
    // User operations
    async getUser(id) {
        console.log('Storage: Looking for user with ID:', id);
        try {
            const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
            const user = result[0];
            if (user) {
                console.log('Storage: Found user:', { id: user.id, username: user.username });
            }
            else {
                console.log('Storage: User not found');
            }
            return user;
        }
        catch (error) {
            console.error('Storage: Error getting user:', error);
            return undefined;
        }
    }
    async getAllUsers() {
        try {
            return await db.select().from(users);
        }
        catch (error) {
            console.error('Storage: Error getting all users:', error);
            return [];
        }
    }
    async getUserByUsername(username) {
        try {
            const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
            return result[0];
        }
        catch (error) {
            console.error('Storage: Error getting user by username:', error);
            return undefined;
        }
    }
    async getUserByEmail(email) {
        try {
            const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
            return result[0];
        }
        catch (error) {
            console.error('Storage: Error getting user by email:', error);
            return undefined;
        }
    }
    async createUser(userData) {
        try {
            const result = await db.insert(users).values(userData).returning();
            const user = result[0];
            console.log('Storage: Created user:', { id: user.id, username: user.username });
            return user;
        }
        catch (error) {
            console.error('Storage: Error creating user:', error);
            throw error;
        }
    }
    async updateUserTier(userId, tier) {
        try {
            await db.update(users).set({ tier }).where(eq(users.id, userId));
        }
        catch (error) {
            console.error('Storage: Error updating user tier:', error);
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
            console.error('Storage: Error updating user:', error);
            throw error;
        }
    }
    async updateUserProfile(userId, updates) {
        try {
            const result = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
            return result[0];
        }
        catch (error) {
            console.error('Storage: Error updating user profile:', error);
            return undefined;
        }
    }
    async updateUserPassword(userId, hashedPassword) {
        try {
            await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
            console.log('Storage: Password updated for user:', userId);
        }
        catch (error) {
            console.error('Storage: Error updating user password:', error);
            throw error;
        }
    }
    async updateUserEmailVerified(userId, verified) {
        try {
            await db.update(users).set({ emailVerified: verified }).where(eq(users.id, userId));
            console.log('Storage: Email verification status updated for user:', userId);
        }
        catch (error) {
            console.error('Storage: Error updating email verification:', error);
            throw error;
        }
    }
    async deleteUser(userId) {
        try {
            await db.delete(users).where(eq(users.id, userId));
        }
        catch (error) {
            console.error('Storage: Error deleting user:', error);
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
            console.error('Storage: Error creating generation:', error);
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
            console.error('Storage: Error getting generations by user ID:', error);
            return [];
        }
    }
    async createContentGeneration(gen) {
        return this.createGeneration(gen);
    }
    async getUserContentGenerations(userId) {
        return this.getGenerationsByUserId(userId);
    }
    async getContentGenerationStats(userId) {
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
        }
        catch (error) {
            console.error('Storage: Error getting content generation stats:', error);
            return { total: 0, thisWeek: 0, thisMonth: 0 };
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
            console.error('Storage: Error getting last generated:', error);
            return undefined;
        }
    }
    // Sample operations
    async createUserSample(sample) {
        try {
            const result = await db.insert(userSamples).values(sample).returning();
            return result[0];
        }
        catch (error) {
            console.error('Storage: Error creating user sample:', error);
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
            console.error('Storage: Error getting user samples:', error);
            return [];
        }
    }
    async deleteUserSample(sampleId, userId) {
        try {
            await db.delete(userSamples).where(and(eq(userSamples.id, sampleId), eq(userSamples.userId, userId)));
        }
        catch (error) {
            console.error('Storage: Error deleting user sample:', error);
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
            console.error('Storage: Error getting user preferences:', error);
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
            console.error('Storage: Error updating user preferences:', error);
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
            console.error('Storage: Error creating user image:', error);
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
            console.error('Storage: Error getting user images:', error);
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
            console.error('Storage: Error getting user image:', error);
            return undefined;
        }
    }
    async deleteUserImage(imageId, userId) {
        try {
            await db.delete(userImages).where(and(eq(userImages.id, imageId), eq(userImages.userId, userId)));
        }
        catch (error) {
            console.error('Storage: Error deleting user image:', error);
            throw error;
        }
    }
}
// Create and export the storage instance
export const storage = new PostgreSQLStorage();
