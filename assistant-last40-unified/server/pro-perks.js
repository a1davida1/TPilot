/**
 * Pro perks and benefits configuration
 */

// Mock pro perks data for testing
export const proPerks = [
  {
    id: 'perk1',
    name: 'Premium Templates',
    description: 'Access to exclusive content templates',
    tier: 'pro',
    category: 'content',
    signupInstructions: 'Visit our premium template library and start creating',
    affiliateUrl: 'https://example.com/premium-templates'
  },
  {
    id: 'perk2', 
    name: 'Advanced Analytics',
    description: 'Detailed performance insights and metrics',
    tier: 'pro',
    category: 'analytics',
    signupInstructions: 'Enable advanced analytics in your dashboard settings',
    affiliateUrl: 'https://example.com/analytics'
  },
  {
    id: 'perk3',
    name: 'Priority Support',
    description: '24/7 priority customer support',
    tier: 'pro',
    category: 'support',
    signupInstructions: 'Contact our priority support team anytime',
    affiliateUrl: 'https://example.com/support'
  }
];

export function getProPerkById(id) {
  return proPerks.find(perk => perk.id === id);
}

export function getAllProPerks() {
  return proPerks;
}

export function getProPerksByTier(tier) {
  return proPerks.filter(perk => perk.tier === tier);
}

export default { proPerks, getProPerkById, getAllProPerks, getProPerksByTier };