// Reddit Communities Database with real metrics and intelligence
export interface RedditCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category: 'premium' | 'general' | 'niche' | 'fetish' | 'verification' | 'gonewild' | 'selling';
  verificationRequired: boolean;
  promotionAllowed: 'yes' | 'limited' | 'subtle' | 'no';
  postingLimits: {
    perDay?: number;
    perWeek?: number;
    cooldownHours?: number;
  };
  rules: {
    minKarma?: number;
    minAccountAge?: number;
    watermarksAllowed?: boolean;
    sellingAllowed?: boolean;
    titleRules?: string[];
    contentRules?: string[];
  };
  bestPostingTimes: string[];
  averageUpvotes: number;
  successProbability: number; // 0-100 score
  growthTrend: 'up' | 'stable' | 'down';
  modActivity: 'high' | 'medium' | 'low';
  description: string;
  tags: string[];
  competitionLevel: 'low' | 'medium' | 'high';
}

// Comprehensive Reddit communities database
export const redditCommunitiesDatabase: RedditCommunity[] = [
  // Premium/High Engagement Communities
  {
    id: 'gonewild',
    name: 'r/gonewild',
    displayName: 'Gone Wild',
    members: 3200000,
    engagementRate: 24.5,
    category: 'gonewild',
    verificationRequired: true,
    promotionAllowed: 'subtle',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 50,
      minAccountAge: 7,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['No selling', 'No usernames in title', 'Age/gender required'],
      contentRules: ['Original content only', 'Must be 18+', 'No face required']
    },
    bestPostingTimes: ['Tuesday 8-10pm EST', 'Thursday 7-9pm EST', 'Sunday 6-8pm EST'],
    averageUpvotes: 2840,
    successProbability: 92,
    growthTrend: 'stable',
    modActivity: 'high',
    description: 'The largest general NSFW community. Extremely high engagement but strict rules.',
    tags: ['high-traffic', 'verification', 'no-selling', 'original-content'],
    competitionLevel: 'high'
  },
  {
    id: 'realgirls',
    name: 'r/RealGirls',
    displayName: 'Real Girls',
    members: 1800000,
    engagementRate: 19.8,
    category: 'premium',
    verificationRequired: true,
    promotionAllowed: 'subtle',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 100,
      minAccountAge: 14,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Descriptive titles', 'No selling language'],
      contentRules: ['Amateur only', 'No professional content', 'Real people only']
    },
    bestPostingTimes: ['Monday 7-9pm EST', 'Wednesday 8-10pm EST', 'Friday 6-8pm EST'],
    averageUpvotes: 2150,
    successProbability: 88,
    growthTrend: 'up',
    modActivity: 'high',
    description: 'High-quality community for amateur content. Strong engagement with real people.',
    tags: ['amateur', 'high-quality', 'verification', 'growing'],
    competitionLevel: 'medium'
  },
  {
    id: 'adorableporn',
    name: 'r/adorableporn',
    displayName: 'Adorable Porn',
    members: 1400000,
    engagementRate: 22.3,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: { perDay: 2, cooldownHours: 12 },
    rules: {
      minKarma: 25,
      minAccountAge: 3,
      watermarksAllowed: true,
      sellingAllowed: false,
      titleRules: ['Keep titles cute/adorable'],
      contentRules: ['Cute aesthetic preferred', 'Artistic content welcome']
    },
    bestPostingTimes: ['Tuesday 9-11am EST', 'Thursday 2-4pm EST', 'Saturday 7-9pm EST'],
    averageUpvotes: 1920,
    successProbability: 85,
    growthTrend: 'up',
    modActivity: 'medium',
    description: 'Cute and adorable content focus. Great for artistic and aesthetic posts.',
    tags: ['cute', 'artistic', 'growing', 'watermarks-ok'],
    competitionLevel: 'medium'
  },
  {
    id: 'petitegonewild',
    name: 'r/PetiteGoneWild',
    displayName: 'Petite Gone Wild',
    members: 1100000,
    engagementRate: 21.7,
    category: 'niche',
    verificationRequired: true,
    promotionAllowed: 'subtle',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 75,
      minAccountAge: 10,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Must fit petite theme', 'Height/weight welcome'],
      contentRules: ['Petite body types', 'Original content only']
    },
    bestPostingTimes: ['Monday 8-10pm EST', 'Wednesday 7-9pm EST', 'Friday 8-10pm EST'],
    averageUpvotes: 1650,
    successProbability: 82,
    growthTrend: 'stable',
    modActivity: 'high',
    description: 'Focused on petite body types. Loyal community with high engagement.',
    tags: ['niche', 'loyal-audience', 'verification', 'specific-type'],
    competitionLevel: 'medium'
  },
  {
    id: 'curvy',
    name: 'r/curvy',
    displayName: 'Curvy',
    members: 950000,
    engagementRate: 18.4,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: { perDay: 2, cooldownHours: 12 },
    rules: {
      minKarma: 10,
      minAccountAge: 1,
      watermarksAllowed: true,
      sellingAllowed: false,
      titleRules: ['Celebrate curves'],
      contentRules: ['Curvy body types', 'Body positive']
    },
    bestPostingTimes: ['Tuesday 1-3pm EST', 'Thursday 8-10pm EST', 'Sunday 3-5pm EST'],
    averageUpvotes: 1420,
    successProbability: 79,
    growthTrend: 'up',
    modActivity: 'medium',
    description: 'Body positive community celebrating curves. Very welcoming and supportive.',
    tags: ['body-positive', 'welcoming', 'curvy', 'supportive'],
    competitionLevel: 'low'
  },
  {
    id: 'milf',
    name: 'r/milf',
    displayName: 'MILF',
    members: 1300000,
    engagementRate: 20.1,
    category: 'niche',
    verificationRequired: true,
    promotionAllowed: 'subtle',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 50,
      minAccountAge: 7,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Age appropriate', 'Mature theme'],
      contentRules: ['Mothers/mature women', 'Age 25+ preferred']
    },
    bestPostingTimes: ['Monday 2-4pm EST', 'Wednesday 12-2pm EST', 'Saturday 10am-12pm EST'],
    averageUpvotes: 1780,
    successProbability: 84,
    growthTrend: 'stable',
    modActivity: 'high',
    description: 'Mature women community. Strong engagement with specific demographic.',
    tags: ['mature', 'mothers', 'loyal', 'specific-demographic'],
    competitionLevel: 'medium'
  },

  // Selling/Promotion Friendly Communities
  {
    id: 'sexsells',
    name: 'r/sexsells',
    displayName: 'SexSells',
    members: 285000,
    engagementRate: 12.8,
    category: 'selling',
    verificationRequired: true,
    promotionAllowed: 'yes',
    postingLimits: { perDay: 3, cooldownHours: 8 },
    rules: {
      minKarma: 200,
      minAccountAge: 30,
      watermarksAllowed: true,
      sellingAllowed: true,
      titleRules: ['[selling] tag required', 'Clear pricing'],
      contentRules: ['Verification required', 'Clear service description']
    },
    bestPostingTimes: ['Monday 10am-12pm EST', 'Wednesday 3-5pm EST', 'Friday 11am-1pm EST'],
    averageUpvotes: 180,
    successProbability: 71,
    growthTrend: 'stable',
    modActivity: 'high',
    description: 'Direct selling community. Lower engagement but monetization focused.',
    tags: ['selling', 'monetization', 'services', 'verification-strict'],
    competitionLevel: 'high'
  },
  {
    id: 'kikdirty',
    name: 'r/kikdirty',
    displayName: 'Kik Dirty',
    members: 125000,
    engagementRate: 8.9,
    category: 'selling',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: { perDay: 5, cooldownHours: 4 },
    rules: {
      minKarma: 5,
      minAccountAge: 1,
      watermarksAllowed: true,
      sellingAllowed: true,
      titleRules: ['Age and location', 'Contact info'],
      contentRules: ['Kik username required', 'Clear intentions']
    },
    bestPostingTimes: ['Daily 6-8pm EST', 'Daily 10pm-12am EST'],
    averageUpvotes: 45,
    successProbability: 65,
    growthTrend: 'down',
    modActivity: 'low',
    description: 'Casual hookup and selling. Easy entry but low engagement quality.',
    tags: ['easy-entry', 'selling', 'low-engagement', 'casual'],
    competitionLevel: 'low'
  },
  {
    id: 'dirtyr4r',
    name: 'r/dirtyr4r',
    displayName: 'Dirty R4R',
    members: 890000,
    engagementRate: 6.2,
    category: 'selling',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 15,
      minAccountAge: 7,
      watermarksAllowed: true,
      sellingAllowed: true,
      titleRules: ['[Age4Age] format', 'Location required'],
      contentRules: ['Personal ads', 'Clear seeking/offering']
    },
    bestPostingTimes: ['Friday 8-10pm EST', 'Saturday 7-9pm EST', 'Sunday 6-8pm EST'],
    averageUpvotes: 85,
    successProbability: 58,
    growthTrend: 'stable',
    modActivity: 'medium',
    description: 'Personal ads community. Good for building client base with patience.',
    tags: ['personal-ads', 'client-building', 'weekend-focused', 'patient-approach'],
    competitionLevel: 'high'
  },

  // Verification Communities
  {
    id: 'getverified',
    name: 'r/GetVerified',
    displayName: 'Get Verified',
    members: 45000,
    engagementRate: 15.6,
    category: 'verification',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: { perDay: 1, cooldownHours: 168 }, // Once per week
    rules: {
      minKarma: 10,
      minAccountAge: 3,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Verification request only'],
      contentRules: ['Follow verification photo rules', 'Clear face and sign']
    },
    bestPostingTimes: ['Monday-Friday 9am-5pm EST'],
    averageUpvotes: 125,
    successProbability: 95,
    growthTrend: 'stable',
    modActivity: 'high',
    description: 'Essential community for getting verified across Reddit. Required first step.',
    tags: ['essential', 'verification', 'required', 'first-step'],
    competitionLevel: 'low'
  },

  // Niche/Fetish Communities (Sample of popular ones)
  {
    id: 'biggerthanyouthought',
    name: 'r/BiggerThanYouThought',
    displayName: 'Bigger Than You Thought',
    members: 1600000,
    engagementRate: 26.8,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'subtle',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 25,
      minAccountAge: 3,
      watermarksAllowed: true,
      sellingAllowed: false,
      titleRules: ['Must fit surprise theme'],
      contentRules: ['Before/reveal format', 'Surprise element required']
    },
    bestPostingTimes: ['Tuesday 7-9pm EST', 'Thursday 8-10pm EST', 'Saturday 6-8pm EST'],
    averageUpvotes: 3200,
    successProbability: 91,
    growthTrend: 'up',
    modActivity: 'medium',
    description: 'Extremely high engagement with surprise reveal format. Great for viral content.',
    tags: ['viral-potential', 'high-engagement', 'surprise', 'format-specific'],
    competitionLevel: 'medium'
  },
  {
    id: 'workgonewild',
    name: 'r/workgonewild',
    displayName: 'Work Gone Wild',
    members: 520000,
    engagementRate: 18.9,
    category: 'fetish',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 20,
      minAccountAge: 5,
      watermarksAllowed: true,
      sellingAllowed: false,
      titleRules: ['Work setting reference'],
      contentRules: ['Work environment', 'Professional attire welcome']
    },
    bestPostingTimes: ['Monday 12-2pm EST', 'Wednesday 11am-1pm EST', 'Friday 4-6pm EST'],
    averageUpvotes: 980,
    successProbability: 76,
    growthTrend: 'stable',
    modActivity: 'medium',
    description: 'Work-themed content. Good engagement during work hours surprisingly.',
    tags: ['work-theme', 'professional', 'daytime-engagement', 'role-play'],
    competitionLevel: 'low'
  },
  {
    id: 'gonewild30plus',
    name: 'r/gonewild30plus',
    displayName: 'Gone Wild 30 Plus',
    members: 680000,
    engagementRate: 19.4,
    category: 'niche',
    verificationRequired: true,
    promotionAllowed: 'subtle',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 75,
      minAccountAge: 14,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Age must be 30+', 'Mature themes'],
      contentRules: ['Must be 30+ years old', 'Verification required']
    },
    bestPostingTimes: ['Tuesday 1-3pm EST', 'Thursday 11am-1pm EST', 'Sunday 2-4pm EST'],
    averageUpvotes: 1320,
    successProbability: 83,
    growthTrend: 'stable',
    modActivity: 'high',
    description: 'Mature community with loyal following. Great for 30+ creators.',
    tags: ['mature', 'loyal', '30+', 'stable-community'],
    competitionLevel: 'low'
  },

  // General/Broad Appeal Communities
  {
    id: 'nsfw',
    name: 'r/NSFW',
    displayName: 'NSFW',
    members: 2100000,
    engagementRate: 16.2,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: { perDay: 1, cooldownHours: 24 },
    rules: {
      minKarma: 100,
      minAccountAge: 10,
      watermarksAllowed: false,
      sellingAllowed: false,
      titleRules: ['Descriptive titles only'],
      contentRules: ['High quality only', 'No amateur content']
    },
    bestPostingTimes: ['Monday 8-10pm EST', 'Wednesday 7-9pm EST', 'Friday 9-11pm EST'],
    averageUpvotes: 1680,
    successProbability: 72,
    growthTrend: 'down',
    modActivity: 'high',
    description: 'Large general NSFW community but very strict quality standards.',
    tags: ['large', 'strict-quality', 'no-amateur', 'established'],
    competitionLevel: 'high'
  },
  {
    id: 'amateur',
    name: 'r/Amateur',
    displayName: 'Amateur',
    members: 890000,
    engagementRate: 17.8,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: { perDay: 2, cooldownHours: 12 },
    rules: {
      minKarma: 15,
      minAccountAge: 3,
      watermarksAllowed: true,
      sellingAllowed: false,
      titleRules: ['Amateur theme'],
      contentRules: ['Non-professional content', 'Authentic amateur only']
    },
    bestPostingTimes: ['Tuesday 6-8pm EST', 'Thursday 7-9pm EST', 'Sunday 5-7pm EST'],
    averageUpvotes: 1240,
    successProbability: 78,
    growthTrend: 'stable',
    modActivity: 'medium',
    description: 'Great for authentic amateur content. Supportive community.',
    tags: ['amateur', 'authentic', 'supportive', 'non-professional'],
    competitionLevel: 'medium'
  }
];

// Intelligence functions
export function getRecommendationsForUser(userStyle: string, experience: string): RedditCommunity[] {
  let recommendations = redditCommunitiesDatabase;

  // Filter based on experience level
  if (experience === 'beginner') {
    recommendations = recommendations.filter(c => 
      c.rules.minKarma === undefined || c.rules.minKarma <= 25
    );
  }

  // Sort by success probability and engagement
  recommendations = recommendations.sort((a, b) => 
    (b.successProbability * b.engagementRate) - (a.successProbability * a.engagementRate)
  );

  return recommendations.slice(0, 20); // Top 20 recommendations
}

export function getCommunitiesByCategory(category: string): RedditCommunity[] {
  if (category === 'all') return redditCommunitiesDatabase;
  return redditCommunitiesDatabase.filter(c => c.category === category);
}

export function searchCommunities(query: string): RedditCommunity[] {
  const lowercaseQuery = query.toLowerCase();
  return redditCommunitiesDatabase.filter(c => 
    c.name.toLowerCase().includes(lowercaseQuery) ||
    c.displayName.toLowerCase().includes(lowercaseQuery) ||
    c.description.toLowerCase().includes(lowercaseQuery) ||
    c.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
}

export function getCommunityInsights(communityId: string): {
  bestTimes: string[];
  successTips: string[];
  warnings: string[];
} {
  const community = redditCommunitiesDatabase.find(c => c.id === communityId);
  if (!community) return { bestTimes: [], successTips: [], warnings: [] };

  const successTips = [];
  const warnings = [];

  // Generate success tips
  if (community.successProbability > 85) {
    successTips.push("High success rate - great choice for reliable engagement");
  }
  if (community.growthTrend === 'up') {
    successTips.push("Growing community - get in early for better visibility");
  }
  if (community.competitionLevel === 'low') {
    successTips.push("Low competition - your content will stand out");
  }

  // Generate warnings
  if (community.verificationRequired) {
    warnings.push("Verification required - complete r/GetVerified first");
  }
  if (community.rules.minKarma && community.rules.minKarma > 50) {
    warnings.push(`Requires ${community.rules.minKarma}+ karma to post`);
  }
  if (community.promotionAllowed === 'no') {
    warnings.push("No promotion allowed - content only");
  }

  return {
    bestTimes: community.bestPostingTimes,
    successTips,
    warnings
  };
}