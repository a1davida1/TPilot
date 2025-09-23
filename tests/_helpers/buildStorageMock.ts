import { vi, type MockInstance } from 'vitest';
import type { IStorage } from '../../server/storage';

type StorageMock = {
  [K in keyof IStorage]: MockInstance<IStorage[K]>;
};

const make = <K extends keyof IStorage>(_key: K): StorageMock[K] => vi.fn<IStorage[K]>();

/**
 * Creates a complete mock of the storage interface with all methods
 * that can be used across different test files
 */
export function buildStorageMock(): StorageMock {
  return {
    // User operations
    getUser: make('getUser'),
    getUserById: make('getUserById'),
    getAllUsers: make('getAllUsers'),
    getUserByUsername: make('getUserByUsername'),
    getUserByEmail: make('getUserByEmail'),
    createUser: make('createUser'),
    updateUserTier: make('updateUserTier'),
    updateUser: make('updateUser'),
    updateUserProfile: make('updateUserProfile'),
    updateUserPassword: make('updateUserPassword'),
    updateUserEmailVerified: make('updateUserEmailVerified'),
    createVerificationToken: make('createVerificationToken'),
    getVerificationToken: make('getVerificationToken'),
    deleteVerificationToken: make('deleteVerificationToken'),
    deleteUser: make('deleteUser'),

    // Generation operations
    createGeneration: make('createGeneration'),
    getGenerationsByUserId: make('getGenerationsByUserId'),
    createContentGeneration: make('createContentGeneration'),
    getUserContentGenerations: make('getUserContentGenerations'),
    getContentGenerationCount: make('getContentGenerationCount'),
    getContentGenerationStats: make('getContentGenerationStats'),
    getLastGenerated: make('getLastGenerated'),

    // Revenue operations
    getRevenue: make('getRevenue'),

    // Preference operations
    getUserPreferences: make('getUserPreferences'),
    updateUserPreferences: make('updateUserPreferences'),

    // Image operations
    createUserImage: make('createUserImage'),
    getUserImages: make('getUserImages'),
    getUserImage: make('getUserImage'),
    updateUserImage: make('updateUserImage'),
    deleteUserImage: make('deleteUserImage'),

    // Streak operations
    calculateDailyStreak: make('calculateDailyStreak'),

    // Admin operations
    getTotalUserCount: make('getTotalUserCount'),
    getActiveUserCount: make('getActiveUserCount'),
    getTotalContentGenerated: make('getTotalContentGenerated'),
    getSubscriptionCounts: make('getSubscriptionCounts'),

    // Generation limit operations
    getDailyGenerationCount: make('getDailyGenerationCount'),

    // Expense operations
    createExpenseCategory: make('createExpenseCategory'),
    getExpenseCategories: make('getExpenseCategories'),
    getExpenseCategory: make('getExpenseCategory'),
    updateExpenseCategory: make('updateExpenseCategory'),
    deleteExpenseCategory: make('deleteExpenseCategory'),

    createExpense: make('createExpense'),
    getUserExpenses: make('getUserExpenses'),
    getExpense: make('getExpense'),
    updateExpense: make('updateExpense'),
    deleteExpense: make('deleteExpense'),
    getExpensesByCategory: make('getExpensesByCategory'),
    getExpensesByDateRange: make('getExpensesByDateRange'),
    getExpenseTotals: make('getExpenseTotals'),

    getTaxDeductionInfo: make('getTaxDeductionInfo'),
    getTaxDeductionInfoByCategory: make('getTaxDeductionInfoByCategory'),
    createTaxDeductionInfo: make('createTaxDeductionInfo'),

    // Social Media operations
    createSocialMediaAccount: make('createSocialMediaAccount'),
    getUserSocialMediaAccounts: make('getUserSocialMediaAccounts'),
    getSocialMediaAccount: make('getSocialMediaAccount'),
    updateSocialMediaAccount: make('updateSocialMediaAccount'),
    deleteSocialMediaAccount: make('deleteSocialMediaAccount'),

    createSocialMediaPost: make('createSocialMediaPost'),
    getUserSocialMediaPosts: make('getUserSocialMediaPosts'),
    getSocialMediaPost: make('getSocialMediaPost'),
    updateSocialMediaPost: make('updateSocialMediaPost'),
    deleteSocialMediaPost: make('deleteSocialMediaPost'),

    createPlatformEngagement: make('createPlatformEngagement'),
    getPlatformEngagement: make('getPlatformEngagement'),

    createPostSchedule: make('createPostSchedule'),
    getUserScheduledPosts: make('getUserScheduledPosts'),
    getPostSchedule: make('getPostSchedule'),
    updatePostSchedule: make('updatePostSchedule'),
    deletePostSchedule: make('deletePostSchedule')
  };
}