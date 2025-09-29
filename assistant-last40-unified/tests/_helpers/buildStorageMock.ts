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
    getExpenseTotals: mock<'getExpenseTotals'>(),

    // Leads operations
    createLead: mock<'createLead'>(),
    getLeads: mock<'getLeads'>(),
    updateLead: mock<'updateLead'>(),
    getLead: mock<'getLead'>(),

    // Sample operations
    createUserSample: mock<'createUserSample'>(),
    getUserSamples: mock<'getUserSamples'>(),
    getUserSample: mock<'getUserSample'>(),
    updateUserSample: mock<'updateUserSample'>(),
    deleteUserSample: mock<'deleteUserSample'>(),

    // Template operations
    createPostTemplate: mock<'createPostTemplate'>(),
    getUserPostTemplates: mock<'getUserPostTemplates'>(),
    getPostTemplate: mock<'getPostTemplate'>(),
    updatePostTemplate: mock<'updatePostTemplate'>(),
    deletePostTemplate: mock<'deletePostTemplate'>(),

    // Job operations  
    createPostJob: mock<'createPostJob'>(),
    getUserPostJobs: mock<'getUserPostJobs'>(),
    getPostJob: mock<'getPostJob'>(),
    updatePostJob: mock<'updatePostJob'>(),
    deletePostJob: mock<'deletePostJob'>(),

    // Preview operations
    createPostPreview: mock<'createPostPreview'>(),
    getUserPostPreviews: mock<'getUserPostPreviews'>(),
    getPostPreview: mock<'getPostPreview'>(),
    updatePostPreview: mock<'updatePostPreview'>(),
    deletePostPreview: mock<'deletePostPreview'>(),

    // Creator account operations
    createCreatorAccount: mock<'createCreatorAccount'>(),
    getUserCreatorAccounts: mock<'getUserCreatorAccounts'>(),
    getCreatorAccount: mock<'getCreatorAccount'>(),
    updateCreatorAccount: mock<'updateCreatorAccount'>(),
    deleteCreatorAccount: mock<'deleteCreatorAccount'>(),

    // Reddit community operations
    getRedditCommunities: mock<'getRedditCommunities'>(),
    getRedditCommunity: mock<'getRedditCommunity'>(),
    createRedditCommunity: mock<'createRedditCommunity'>(),
    updateRedditCommunity: mock<'updateRedditCommunity'>(),
    deleteRedditCommunity: mock<'deleteRedditCommunity'>(),
  };
}