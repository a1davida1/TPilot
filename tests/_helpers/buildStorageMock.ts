import { vi, type MockedFunction } from 'vitest';
import type { IStorage } from '../../server/storage';

/**
 * Creates a complete mock of the storage interface with all methods
 * that can be used across different test files
 */
export function buildStorageMock(): Record<keyof IStorage, MockedFunction<any>> {
  return {
    // User operations
    getUser: vi.fn(),
    getUserById: vi.fn(),
    getAllUsers: vi.fn(),
    getUserByUsername: vi.fn(),
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUserTier: vi.fn(),
    updateUser: vi.fn(),
    updateUserProfile: vi.fn(),
    updateUserPassword: vi.fn(),
    updateUserEmailVerified: vi.fn(),
    createVerificationToken: vi.fn(),
    getVerificationToken: vi.fn(),
    deleteVerificationToken: vi.fn(),
    deleteUser: vi.fn(),

    // Generation operations
    createGeneration: vi.fn(),
    getGenerationsByUserId: vi.fn(),
    createContentGeneration: vi.fn(),
    getUserContentGenerations: vi.fn(),
    getContentGenerationCount: vi.fn(),
    getContentGenerationStats: vi.fn(),
    getLastGenerated: vi.fn(),

    // Revenue operations
    getRevenue: vi.fn(),

    // Preference operations
    getUserPreferences: vi.fn(),
    updateUserPreferences: vi.fn(),

    // Image operations
    createUserImage: vi.fn(),
    getUserImages: vi.fn(),
    getUserImage: vi.fn(),
    updateUserImage: vi.fn(),
    deleteUserImage: vi.fn(),

    // Streak operations
    calculateDailyStreak: vi.fn(),

    // Admin operations
    getTotalUserCount: vi.fn(),
    getActiveUserCount: vi.fn(),
    getTotalContentGenerated: vi.fn(),
    getSubscriptionCounts: vi.fn(),

    // Generation limit operations
    getDailyGenerationCount: vi.fn(),

    // Expense operations
    createExpenseCategory: vi.fn(),
    getExpenseCategories: vi.fn(),
    getExpenseCategory: vi.fn(),
    updateExpenseCategory: vi.fn(),
    deleteExpenseCategory: vi.fn(),
    
    createExpense: vi.fn(),
    getUserExpenses: vi.fn(),
    getExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    getExpensesByCategory: vi.fn(),
    getExpensesByDateRange: vi.fn(),
    getExpenseTotals: vi.fn(),

    getTaxDeductionInfo: vi.fn(),
    getTaxDeductionInfoByCategory: vi.fn(),
    createTaxDeductionInfo: vi.fn(),

    // Social Media operations
    createSocialMediaAccount: vi.fn(),
    getUserSocialMediaAccounts: vi.fn(),
    getSocialMediaAccount: vi.fn(),
    updateSocialMediaAccount: vi.fn(),
    deleteSocialMediaAccount: vi.fn(),

    createSocialMediaPost: vi.fn(),
    getUserSocialMediaPosts: vi.fn(),
    getSocialMediaPost: vi.fn(),
    updateSocialMediaPost: vi.fn(),
    deleteSocialMediaPost: vi.fn(),

    createPlatformEngagement: vi.fn(),
    getPlatformEngagement: vi.fn(),

    createPostSchedule: vi.fn(),
    getUserScheduledPosts: vi.fn(),
    getPostSchedule: vi.fn(),
    updatePostSchedule: vi.fn(),
    deletePostSchedule: vi.fn()
  };
}