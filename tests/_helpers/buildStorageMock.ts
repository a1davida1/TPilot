import { vi, type MockedFunction } from 'vitest';
import type { IStorage } from '../../server/storage';

type StorageMock = { [K in keyof IStorage]: MockedFunction<IStorage[K]> };

const mock = <K extends keyof IStorage>() => vi.fn<IStorage[K]>();

/**
 * Creates a complete mock of the storage interface with all methods
 * that can be used across different test files
 */
export function buildStorageMock(): StorageMock {
  return {
    // User operations
    getUser: mock<'getUser'>(),
    getUserById: mock<'getUserById'>(),
    getAllUsers: mock<'getAllUsers'>(),
    getUserByUsername: mock<'getUserByUsername'>(),
    getUserByEmail: mock<'getUserByEmail'>(),
    createUser: mock<'createUser'>(),
    updateUserTier: mock<'updateUserTier'>(),
    updateUser: mock<'updateUser'>(),
    updateUserProfile: mock<'updateUserProfile'>(),
    updateUserPassword: mock<'updateUserPassword'>(),
    updateUserEmailVerified: mock<'updateUserEmailVerified'>(),
    createVerificationToken: mock<'createVerificationToken'>(),
    getVerificationToken: mock<'getVerificationToken'>(),
    deleteVerificationToken: mock<'deleteVerificationToken'>(),
    deleteUser: mock<'deleteUser'>(),

    // Generation operations
    createGeneration: mock<'createGeneration'>(),
    getGenerationsByUserId: mock<'getGenerationsByUserId'>(),
    createContentGeneration: mock<'createContentGeneration'>(),
    getUserContentGenerations: mock<'getUserContentGenerations'>(),
    getContentGenerationCount: mock<'getContentGenerationCount'>(),
    getContentGenerationStats: mock<'getContentGenerationStats'>(),
    getLastGenerated: mock<'getLastGenerated'>(),

    // Revenue operations
    getRevenue: mock<'getRevenue'>(),

    // Preference operations
    getUserPreferences: mock<'getUserPreferences'>(),
    updateUserPreferences: mock<'updateUserPreferences'>(),

    // Image operations
    createUserImage: mock<'createUserImage'>(),
    getUserImages: mock<'getUserImages'>(),
    getUserImage: mock<'getUserImage'>(),
    updateUserImage: mock<'updateUserImage'>(),
    deleteUserImage: mock<'deleteUserImage'>(),

    // Streak operations
    calculateDailyStreak: mock<'calculateDailyStreak'>(),

    // Admin operations
    getTotalUserCount: mock<'getTotalUserCount'>(),
    getActiveUserCount: mock<'getActiveUserCount'>(),
    getTotalContentGenerated: mock<'getTotalContentGenerated'>(),
    getSubscriptionCounts: mock<'getSubscriptionCounts'>(),

    // Generation limit operations
    getDailyGenerationCount: mock<'getDailyGenerationCount'>(),

    // Expense operations
    createExpenseCategory: mock<'createExpenseCategory'>(),
    getExpenseCategories: mock<'getExpenseCategories'>(),
    getExpenseCategory: mock<'getExpenseCategory'>(),
    updateExpenseCategory: mock<'updateExpenseCategory'>(),
    deleteExpenseCategory: mock<'deleteExpenseCategory'>(),

    createExpense: mock<'createExpense'>(),
    getUserExpenses: mock<'getUserExpenses'>(),
    getExpense: mock<'getExpense'>(),
    updateExpense: mock<'updateExpense'>(),
    deleteExpense: mock<'deleteExpense'>(),
    getExpensesByCategory: mock<'getExpensesByCategory'>(),
    getExpensesByDateRange: mock<'getExpensesByDateRange'>(),
    getExpenseTotals: mock<'getExpenseTotals'>(),

    getTaxDeductionInfo: mock<'getTaxDeductionInfo'>(),
    getTaxDeductionInfoByCategory: mock<'getTaxDeductionInfoByCategory'>(),
    createTaxDeductionInfo: mock<'createTaxDeductionInfo'>(),

    // Social Media operations
    createSocialMediaAccount: mock<'createSocialMediaAccount'>(),
    getUserSocialMediaAccounts: mock<'getUserSocialMediaAccounts'>(),
    getSocialMediaAccount: mock<'getSocialMediaAccount'>(),
    updateSocialMediaAccount: mock<'updateSocialMediaAccount'>(),
    deleteSocialMediaAccount: mock<'deleteSocialMediaAccount'>(),

    createSocialMediaPost: mock<'createSocialMediaPost'>(),
    getUserSocialMediaPosts: mock<'getUserSocialMediaPosts'>(),
    getSocialMediaPost: mock<'getSocialMediaPost'>(),
    updateSocialMediaPost: mock<'updateSocialMediaPost'>(),
    deleteSocialMediaPost: mock<'deleteSocialMediaPost'>(),

    createPlatformEngagement: mock<'createPlatformEngagement'>(),
    getPlatformEngagement: mock<'getPlatformEngagement'>(),

    createPostSchedule: mock<'createPostSchedule'>(),
    getUserScheduledPosts: mock<'getUserScheduledPosts'>(),
    getPostSchedule: mock<'getPostSchedule'>(),
    updatePostSchedule: mock<'updatePostSchedule'>(),
    deletePostSchedule: mock<'deletePostSchedule'>()
  };
}