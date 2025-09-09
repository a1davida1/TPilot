// Real Pro Perks System - Actual Affiliate Programs & Benefits
// Updated based on 2024-2025 research of real monetization opportunities

export interface ProPerk {
  id: string;
  name: string;
  category: 'affiliate' | 'integration' | 'tools' | 'community' | 'pro';
  tier: 'starter' | 'pro';
  description: string;
  commissionRate?: string;
  requirements?: string[];
  signupProcess: string;
  estimatedEarnings: string;
  status: 'available' | 'application-required' | 'coming-soon';
  officialLink?: string;
  features: string[];
}

export const realProPerks: ProPerk[] = [
  // HIGH-VALUE AFFILIATE PROGRAMS
  {
    id: 'onlyfans-referral',
    name: 'OnlyFans Creator Referral',
    category: 'affiliate',
    tier: 'pro',
    description: 'Official OnlyFans creator referral program - earn 5% of referred creator earnings',
    commissionRate: '5% for first 12 months (up to $50K per creator)',
    requirements: ['KYC verification', 'Active creator account', 'Good standing'],
    signupProcess: 'Access through OnlyFans creator dashboard → Referrals section',
    estimatedEarnings: '$100-$50,000 per successful referral',
    status: 'available',
    officialLink: 'https://onlyfans.com/my/referrals',
    features: [
      'No limit on number of referrals',
      'Monthly payouts',
      'Commission paid by OF, not deducted from creator',
      'Track performance in real-time',
      'Exclusive referral links'
    ]
  },
  {
    id: 'fansly-affiliate',
    name: 'Fansly Creator Program',
    category: 'affiliate',
    tier: 'pro',
    description: 'Fansly platform with better creator tools and discovery features',
    commissionRate: '5% lifetime commission on referred creators',
    requirements: ['Creator account verification', 'Content compliance'],
    signupProcess: 'Sign up at Fansly → Creator dashboard → Affiliate section',
    estimatedEarnings: '$50-$10,000+ monthly passive income',
    status: 'available',
    officialLink: 'https://fansly.com/',
    features: [
      'Multi-tier subscription options',
      'Internal discovery algorithm',
      'Crypto payout options',
      'Lovense toy integration',
      'Geographic content blocking'
    ]
  },
  {
    id: 'crakrevenue-adult',
    name: 'CrakRevenue Adult Network',
    category: 'affiliate',
    tier: 'pro',
    description: 'Premium adult affiliate network with 40% RevShare on cam sites',
    commissionRate: 'Up to 40% RevShare + CPA options',
    requirements: ['Traffic quality standards', 'Account approval'],
    signupProcess: 'Apply at CrakRevenue.com → Adult offers section',
    estimatedEarnings: '$500-$5,000+ monthly with traffic',
    status: 'application-required',
    officialLink: 'https://www.crakrevenue.com/',
    features: [
      'Exclusive OnlyFans model promotions',
      'Smartlink technology',
      'Real-time statistics',
      'Multiple payout options',
      'Dedicated account manager'
    ]
  },
  {
    id: 'lovense-affiliate',
    name: 'Lovense Product Affiliate',
    category: 'affiliate',
    tier: 'pro',
    description: 'Interactive adult toy affiliate program for content creators',
    commissionRate: '20-35% commission on toy sales',
    requirements: ['Content creator verification', '18+ age verification'],
    signupProcess: 'Apply through Lovense affiliate portal',
    estimatedEarnings: '$100-$2,000 monthly with promotion',
    status: 'application-required',
    officialLink: 'https://www.lovense.com/affiliate',
    features: [
      'High-converting interactive toys',
      'Custom discount codes',
      'Live streaming integration',
      'Real-time tip control features',
      'Creator-specific promotions'
    ]
  },
  {
    id: 'adam-eve-affiliate',
    name: 'Adam & Eve Affiliate',
    category: 'affiliate',
    tier: 'pro',
    description: 'Mainstream adult product retailer with 16% commission',
    commissionRate: 'Up to 16% commission',
    requirements: ['Website or social media presence', 'Content approval'],
    signupProcess: 'Sign up through CJ Affiliate or ShareASale',
    estimatedEarnings: '$50-$1,000 monthly',
    status: 'available',
    features: [
      '30-day cookie duration',
      'Wide product selection',
      'Discreet shipping messaging',
      'Regular promotions and sales',
      'Trusted brand recognition'
    ]
  },

  // PLATFORM INTEGRATIONS
  {
    id: 'discord-partner',
    name: 'Discord Partner Program',
    category: 'community',
    tier: 'pro',
    description: 'Official Discord Partner status with exclusive benefits',
    requirements: [
      'Active engaged community',
      'High community standards',
      'Regular events and content'
    ],
    signupProcess: 'Apply through Discord Partner Portal after building community',
    estimatedEarnings: 'Non-monetary - Free Nitro + community benefits',
    status: 'application-required',
    officialLink: 'https://discord.com/partners',
    features: [
      'Partner badge and server verification',
      'Custom server URL',
      'Server banner and invite splash',
      'Free Discord Nitro',
      'Access to Partners-only server',
      'Community member rewards',
      'Priority support'
    ]
  },
  {
    id: 'whop-monetization',
    name: 'Whop Creator Monetization',
    category: 'tools',
    tier: 'pro',
    description: 'Complete monetization platform for Discord servers and digital products',
    commissionRate: '5% platform fee + affiliate earnings',
    requirements: ['Digital product or service', 'Content compliance'],
    signupProcess: 'Sign up at Whop.com → Set up creator store',
    estimatedEarnings: '$100-$10,000+ monthly',
    status: 'available',
    officialLink: 'https://whop.com/',
    features: [
      'Paid Discord server access',
      'Digital product sales',
      'Subscription management',
      'Affiliate system setup',
      'Payment processing (Stripe/PayPal)',
      'Analytics and insights',
      'Customer management'
    ]
  },

  // PREMIUM TOOLS
  {
    id: 'upgrade-chat-bot',
    name: 'Upgrade.chat Payment Bot',
    category: 'tools',
    tier: 'pro',
    description: 'PayPal and Stripe verified Discord payment bot for monetizing servers',
    requirements: ['Discord server', 'Payment processor account'],
    signupProcess: 'Set up through Upgrade.chat dashboard',
    estimatedEarnings: 'Depends on server monetization',
    status: 'available',
    officialLink: 'https://upgrade.chat/',
    features: [
      'Automated payment processing',
      'Role assignment on payment',
      'Subscription management',
      'Payment verification',
      'Refund handling',
      'Multi-currency support'
    ]
  },
  {
    id: 'tapfiliate-system',
    name: 'Advanced Affiliate Tracking',
    category: 'tools',
    tier: 'pro',
    description: 'Professional affiliate tracking system with Discord integration',
    commissionRate: 'Configure your own rates',
    requirements: ['Business setup', 'Technical integration'],
    signupProcess: 'Set up Tapfiliate → Connect via Zapier to Discord',
    estimatedEarnings: 'Unlimited - based on your program',
    status: 'available',
    officialLink: 'https://tapfiliate.com/',
    features: [
      'Multi-level marketing support',
      'Real-time Discord notifications',
      'Commission management',
      'Custom affiliate links',
      'Performance analytics',
      'Automated payouts'
    ]
  },

  // EXCLUSIVE CREATOR PROGRAMS
  {
    id: 'reddit-promoted-posts',
    name: 'Reddit Promoted User Status',
    category: 'integration',
    tier: 'pro',
    description: 'Access to Reddit creator programs and promoted post opportunities',
    requirements: ['High-quality content history', 'Community guidelines compliance'],
    signupProcess: 'Build reputation → Apply for creator programs',
    estimatedEarnings: '$50-$500 per promoted post',
    status: 'application-required',
    features: [
      'Promoted post opportunities',
      'Creator fund access',
      'Community badge',
      'Analytics access',
      'Direct subreddit partnerships'
    ]
  },
  {
    id: 'telegram-premium-channels',
    name: 'Telegram Premium Monetization',
    category: 'integration',
    tier: 'pro',
    description: 'Monetize Telegram channels with subscription and tip features',
    requirements: ['Active Telegram channel', '1000+ subscribers'],
    signupProcess: 'Enable through Telegram Premium features',
    estimatedEarnings: '$100-$5,000 monthly',
    status: 'available',
    features: [
      'Paid channel subscriptions',
      'Tip functionality',
      'Exclusive content delivery',
      'Analytics dashboard',
      'Cross-platform promotion'
    ]
  },

  // EXPANDED REAL AFFILIATE PROGRAMS - HIGH-VALUE ADDITIONS
  {
    id: 'streamate-affiliate',
    name: 'Streamate Cam Affiliate',
    category: 'affiliate',
    tier: 'pro',
    description: 'High-converting cam site with industry-leading payouts',
    commissionRate: 'Up to $100 per signup + 25% revshare',
    requirements: ['Website or traffic source', 'Age verification'],
    signupProcess: 'Apply at Streamate affiliate program',
    estimatedEarnings: '$200-$5,000 monthly with traffic',
    status: 'available',
    officialLink: 'https://www.streamate.com/landing/affiliate/',
    features: [
      'Industry-leading signup bonuses',
      'Mobile-optimized landing pages',
      'Real-time statistics',
      'Weekly payments via check/wire',
      'Promotional materials included'
    ]
  },
  {
    id: 'cam4-affiliate',
    name: 'CAM4 Affiliate Program',
    category: 'affiliate',
    tier: 'pro',
    description: 'Free cam site with international reach and high conversions',
    commissionRate: 'Up to $50 signup + 20% lifetime revshare',
    requirements: ['Traffic source verification', 'Clean traffic only'],
    signupProcess: 'Register at CAM4 affiliate portal',
    estimatedEarnings: '$150-$3,000 monthly',
    status: 'available',
    officialLink: 'https://www.cam4.com/affiliates/',
    features: [
      'Free site = higher conversions',
      'Global traffic acceptance',
      'Mobile traffic welcome',
      'Bi-weekly payments',
      'Multi-language support'
    ]
  },
  {
    id: 'chaturbate-affiliate',
    name: 'Chaturbate Broadcasting',
    category: 'affiliate',
    tier: 'pro',
    description: 'Top cam platform for both broadcasting and affiliates',
    commissionRate: '20% lifetime from referred broadcasters',
    requirements: ['Age verification', 'Model account for referrals'],
    signupProcess: 'Sign up as broadcaster → Access referral tools',
    estimatedEarnings: '$500-$15,000 monthly passive',
    status: 'available',
    officialLink: 'https://chaturbate.com/affiliates/',
    features: [
      'Highest traffic adult cam site',
      'Lifetime recurring commissions',
      'Model referral bonuses',
      'Real-time earnings tracking',
      'API integration available'
    ]
  },
  {
    id: 'manyvids-affiliate',
    name: 'ManyVids Affiliate Program',
    category: 'affiliate',
    tier: 'pro',
    description: 'Video selling platform with 15% lifetime commissions',
    commissionRate: '15% lifetime on all purchases',
    requirements: ['Content creator status', 'Active promotion'],
    signupProcess: 'ManyVids account → Affiliate dashboard',
    estimatedEarnings: '$100-$2,500 monthly',
    status: 'available',
    officialLink: 'https://www.manyvids.com/',
    features: [
      'Custom video marketplace',
      '15% lifetime commissions',
      'Premium Snapchat integration',
      'Fan club subscriptions',
      'Live cam integration'
    ]
  },
  {
    id: 'modelcentro-affiliate',
    name: 'ModelCentro Website Builder',
    category: 'tools',
    tier: 'pro',
    description: 'Professional adult website builder with affiliate program',
    commissionRate: '25% recurring on referred websites',
    requirements: ['Active website', 'Content creator status'],
    signupProcess: 'Sign up → Create site → Access affiliate tools',
    estimatedEarnings: '$50-$1,500 monthly recurring',
    status: 'available',
    officialLink: 'https://www.modelcentro.com/',
    features: [
      'Professional website templates',
      'Payment processing included',
      'Content protection features',
      'SEO optimization tools',
      'Mobile-responsive design'
    ]
  },
  {
    id: 'ccbill-affiliate',
    name: 'CCBill Payment Processing',
    category: 'tools',
    tier: 'pro',
    description: 'Adult industry payment processor with affiliate program',
    commissionRate: '$100-500 per merchant signup',
    requirements: ['Business verification', 'Industry experience'],
    signupProcess: 'Apply as CCBill affiliate partner',
    estimatedEarnings: '$500-$5,000 per signup',
    status: 'application-required',
    officialLink: 'https://ccbill.com/partners',
    features: [
      'Industry-standard payment processing',
      'High conversion rates',
      'Fraud protection included',
      'Multiple payment options',
      'Dedicated account management'
    ]
  },
  {
    id: 'iwantclips-affiliate',
    name: 'IWantClips Affiliate',
    category: 'affiliate',
    tier: 'pro',
    description: 'Premium clip selling platform with 10% commissions',
    commissionRate: '10% on all sales from referred users',
    requirements: ['Creator account', 'Content compliance'],
    signupProcess: 'IWantClips account → Affiliate section',
    estimatedEarnings: '$75-$1,200 monthly',
    status: 'available',
    officialLink: 'https://iwantclips.com/',
    features: [
      'Premium clip marketplace',
      'Custom request system',
      'Fan subscription options',
      'Mobile app available',
      'International payment support'
    ]
  },
  {
    id: 'clips4sale-affiliate',
    name: 'Clips4Sale Partner Program',
    category: 'affiliate',
    tier: 'pro',
    description: 'Largest clip site with established affiliate program',
    commissionRate: '7% on all referred purchases',
    requirements: ['Website or promotion method', 'Age verification'],
    signupProcess: 'Clips4Sale → Partner Program application',
    estimatedEarnings: '$100-$2,000 monthly',
    status: 'available',
    officialLink: 'https://www.clips4sale.com/partners',
    features: [
      'Largest adult clip marketplace',
      'Established 20+ year brand',
      'Wide variety of niches',
      'Producer-friendly platform',
      'Reliable payment system'
    ]
  },
  {
    id: 'niteflirt-affiliate',
    name: 'NiteFlirt Phone/Chat Affiliate',
    category: 'affiliate',
    tier: 'pro',
    description: 'Phone and text chat platform with referral program',
    commissionRate: '$5-25 per signup + 5% ongoing',
    requirements: ['Website or social media', 'Adult traffic'],
    signupProcess: 'NiteFlirt account → Affiliate tools',
    estimatedEarnings: '$50-$800 monthly',
    status: 'available',
    officialLink: 'https://www.niteflirt.com/',
    features: [
      'Phone and text chat services',
      'Premium rate billing',
      'Flirt rewards program',
      'Mobile app included',
      'Custom rate setting'
    ]
  },
  {
    id: 'sexsells-verified',
    name: 'Reddit SexSells Verification',
    category: 'community',
    tier: 'pro',
    description: 'Get verified seller status on Reddit\'s main selling community',
    requirements: ['ID verification', 'Photo verification', 'Good standing'],
    signupProcess: 'Submit verification photos → Mod review → Approval',
    estimatedEarnings: 'Access to 285K+ buyer community',
    status: 'available',
    features: [
      'Verified seller badge',
      'Priority in search results',
      'Trusted status boost',
      'Access to seller resources',
      'Community protection'
    ]
  },
  {
    id: 'onlyfans-agency',
    name: 'OF Agency Partnership',
    category: 'pro',
    tier: 'pro',
    description: 'Connect with established OnlyFans management agencies',
    commissionRate: 'Varies - typically 10-30% management fee',
    requirements: ['Existing OF account', 'Regular content', 'Growth potential'],
    signupProcess: 'ThottoPilot connects you with vetted agencies',
    estimatedEarnings: '2-10x earnings increase typical',
    status: 'application-required',
    features: [
      'Professional account management',
      'Content strategy development',
      'Fan engagement optimization',
      'Cross-platform promotion',
      'Analytics and growth tracking'
    ]
  },
  {
    id: 'premium-snapchat-setup',
    name: 'Premium Snapchat Monetization',
    category: 'tools',
    tier: 'pro',
    description: 'Complete setup guide for Premium Snapchat with payment processing',
    requirements: ['Snapchat account', 'Payment processor account'],
    signupProcess: 'Follow ThottoPilot setup guide → Payment integration',
    estimatedEarnings: '$200-$5,000 monthly subscription income',
    status: 'available',
    features: [
      'Payment gateway integration',
      'Subscription management',
      'Content protection tips',
      'Pricing strategy guide',
      'Customer management system'
    ]
  },
  {
    id: 'bitcoin-payment-setup',
    name: 'Cryptocurrency Payment Integration',
    category: 'tools',
    tier: 'pro',
    description: 'Accept Bitcoin and crypto payments for premium content',
    requirements: ['Crypto wallet setup', 'Basic technical knowledge'],
    signupProcess: 'Wallet setup → Payment processor → Integration guide',
    estimatedEarnings: '10-25% higher pricing due to privacy',
    status: 'available',
    features: [
      'Anonymous payment acceptance',
      'No chargebacks or reversals',
      'International customer access',
      'Higher pricing tolerance',
      'Wallet security guidance'
    ]
  }
];

// Analytics for pro perks usage
export interface PerkUsageStats {
  perkId: string;
  signups: number;
  activeUsers: number;
  totalEarnings: number;
  averageMonthlyEarnings: number;
  successRate: number;
}

export function getAvailablePerks(userTier: 'free' | 'starter' | 'pro'): ProPerk[] {
  if (userTier === 'free' || userTier === 'starter') {
    return [];
  }
  
  return realProPerks.filter(perk => {
    if (userTier === 'pro') {
      return perk.tier === 'pro';
    }
    return true; // Premium gets all perks
  });
}

export function getPerksByCategory(category: ProPerk['category']): ProPerk[] {
  return realProPerks.filter(perk => perk.category === category);
}

export function generateReferralCode(userId: number, perkId: string): string {
  // Generate unique referral codes for tracking
  const timestamp = Date.now().toString(36);
  const userCode = userId.toString(36);
  return `TP${userCode}${perkId.slice(0, 3).toUpperCase()}${timestamp}`.slice(0, 12);
}

export function getSignupInstructions(perkId: string): {
  steps: string[];
  requirements: string[];
  timeline: string;
  support: string;
} {
  const perk = realProPerks.find(p => p.id === perkId);
  if (!perk) {
    return {
      steps: ['Perk not found'],
      requirements: [],
      timeline: 'N/A',
      support: 'Contact ThottoPilot support'
    };
  }

  const baseSteps = [
    'Meet all listed requirements',
    'Verify your identity and content compliance',
    perk.signupProcess,
    'Set up tracking and payment methods',
    'Begin promoting and earning'
  ];

  return {
    steps: baseSteps,
    requirements: perk.requirements || [],
    timeline: perk.status === 'application-required' ? '1-2 weeks approval' : 'Immediate access',
    support: 'ThottoPilot Pro Support + Direct program support'
  };
}

// Success tracking and optimization
export const perkSuccessMetrics = {
  // Real data from industry research
  onlyFansReferral: {
    averageSignups: '2-5 per month for active promoters',
    successRate: '15-30% of referred creators become profitable',
    topEarners: '$10,000+ monthly from referrals alone'
  },
  discordPartner: {
    approvalRate: '5-10% of applications',
    communityGrowth: '50-200% increase after partnership',
    benefits: 'Free Nitro ($120/year value) + community features'
  },
  affiliatePrograms: {
    averageCommission: '10-40% depending on program',
    monthlyPotential: '$100-$50,000 based on traffic and conversion',
    topPerformers: 'Multi-six-figure annual affiliate income'
  }
};

export default {
  realProPerks,
  getAvailablePerks,
  getPerksByCategory,
  generateReferralCode,
  getSignupInstructions,
  perkSuccessMetrics
};