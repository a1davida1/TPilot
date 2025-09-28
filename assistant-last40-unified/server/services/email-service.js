/**
 * Email service for handling email functionality
 */

// Email service placeholder implementation
export const emailService = {
  sendVerificationEmail: async (email, token) => {
    // Mock implementation for testing
    return { success: true, messageId: 'mock-id' };
  },
  
  sendPasswordResetEmail: async (email, token) => {
    // Mock implementation for testing
    return { success: true, messageId: 'mock-id' };
  }
};

export default emailService;