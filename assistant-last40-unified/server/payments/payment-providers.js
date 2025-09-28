/**
 * Payment provider implementations for various payment gateways
 */

// Mock payment provider implementations for testing
export function makePaxum(config = {}) {
  return {
    name: 'Paxum',
    createPayment: async (amount, currency, metadata) => {
      // Mock implementation
      return { id: 'paxum_mock_' + Date.now(), amount, currency, status: 'pending' };
    },
    verifyPayment: async (paymentId) => {
      // Mock implementation  
      return { id: paymentId, status: 'completed' };
    }
  };
}

export function makeCoinbase(config = {}) {
  return {
    name: 'Coinbase',
    createPayment: async (amount, currency, metadata) => {
      // Mock implementation
      return { id: 'coinbase_mock_' + Date.now(), amount, currency, status: 'pending' };
    },
    verifyPayment: async (paymentId) => {
      // Mock implementation
      return { id: paymentId, status: 'completed' };
    }
  };
}

export function makeStripe(config = {}) {
  return {
    name: 'Stripe',
    createPayment: async (amount, currency, metadata) => {
      // Mock implementation
      return { id: 'stripe_mock_' + Date.now(), amount, currency, status: 'pending' };
    },
    verifyPayment: async (paymentId) => {
      // Mock implementation
      return { id: paymentId, status: 'completed' };
    }
  };
}