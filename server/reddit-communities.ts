// Comprehensive Reddit communities database for adult content creators
// Includes engagement metrics, rules, and posting requirements

export interface RedditCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number; // percentage
  category: 'premium' | 'general' | 'niche' | 'fetish' | 'verification';
  verificationRequired: boolean;
  promotionAllowed: 'yes' | 'limited' | 'no';
  postingLimits: {
    perDay?: number;
    perWeek?: number;
    perMonth?: number;
    cooldownHours?: number; // hours between posts
  };
  rules: {
    minKarma?: number;
    minAccountAge?: number; // in days
    titleRequirements?: string[];
    bannedWords?: string[];
    watermarksAllowed?: boolean;
    sellingAllowed?: boolean;
    dmAdvertisingAllowed?: boolean;
  };
  bestPostingTimes: string[]; // e.g., ["Mon 8PM EST", "Fri 10PM EST"]
  contentPreferences: string[];
  averageUpvotes: number;
  description: string;
}

export const redditCommunities: RedditCommunity[] = [
  // Premium High-Engagement Communities
  {
    id: 'gonewild',
    name: 'r/gonewild',
    displayName: 'Gone Wild',
    members: 3400000,
    engagementRate: 8.5,
    category: 'premium',
    verificationRequired: true,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 3,
      cooldownHours: 8
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      titleRequirements: ['[f]', '[m]', 'age'],
      watermarksAllowed: false,
      sellingAllowed: false,
      dmAdvertisingAllowed: false
    },
    bestPostingTimes: ['Tue 9PM EST', 'Thu 10PM EST', 'Sat 11PM EST'],
    contentPreferences: ['amateur', 'verification', 'authentic'],
    averageUpvotes: 450,
    description: 'Largest amateur community, strict no selling policy'
  },
  {
    id: 'realgirls',
    name: 'r/RealGirls',
    displayName: 'Real Girls',
    members: 2800000,
    engagementRate: 7.2,
    category: 'premium',
    verificationRequired: true,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 200,
      minAccountAge: 60,
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Mon 8PM EST', 'Wed 9PM EST', 'Fri 10PM EST'],
    contentPreferences: ['natural', 'amateur', 'authentic'],
    averageUpvotes: 380,
    description: 'High-quality amateur content only'
  },
  {
    id: 'petitegonewild',
    name: 'r/PetiteGoneWild',
    displayName: 'Petite Gone Wild',
    members: 1900000,
    engagementRate: 9.1,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 6
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      titleRequirements: ['height', 'weight optional'],
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 7PM EST', 'Thu 8PM EST', 'Sun 9PM EST'],
    contentPreferences: ['petite', 'small', 'slim'],
    averageUpvotes: 520,
    description: 'For petite women, high engagement'
  },

  // General Communities with Promotion
  {
    id: 'onlyfans',
    name: 'r/OnlyFans',
    displayName: 'OnlyFans',
    members: 850000,
    engagementRate: 5.5,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 5,
      cooldownHours: 2
    },
    rules: {
      minKarma: 10,
      minAccountAge: 3,
      watermarksAllowed: true,
      sellingAllowed: true,
      dmAdvertisingAllowed: true
    },
    bestPostingTimes: ['Daily 6PM-11PM EST'],
    contentPreferences: ['promotional', 'teasers', 'links'],
    averageUpvotes: 120,
    description: 'Main promotional subreddit for OF creators'
  },
  {
    id: 'onlyfansgirls101',
    name: 'r/OnlyFansGirls101',
    displayName: 'OnlyFans Girls 101',
    members: 2100000,
    engagementRate: 6.8,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 3,
      cooldownHours: 4
    },
    rules: {
      minKarma: 20,
      minAccountAge: 7,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 7PM EST', 'Wed 8PM EST', 'Fri 9PM EST', 'Sun 10PM EST'],
    contentPreferences: ['promotional', 'variety', 'teasers'],
    averageUpvotes: 180,
    description: 'Large promotional community for female creators'
  },
  {
    id: 'onlyfanspromotion',
    name: 'r/OnlyFansPromotions',
    displayName: 'OnlyFans Promotions',
    members: 1450000,
    engagementRate: 5.2,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 4,
      cooldownHours: 3
    },
    rules: {
      minKarma: 15,
      minAccountAge: 5,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 5PM-10PM EST'],
    contentPreferences: ['promotional', 'sales', 'discounts'],
    averageUpvotes: 95,
    description: 'Dedicated to promoting OnlyFans accounts'
  },

  // Niche Communities
  {
    id: 'thick',
    name: 'r/thick',
    displayName: 'Thick',
    members: 1600000,
    engagementRate: 7.8,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 8PM EST', 'Thu 9PM EST', 'Sat 10PM EST'],
    contentPreferences: ['curvy', 'thick', 'voluptuous'],
    averageUpvotes: 340,
    description: 'For curvy and thick body types'
  },
  {
    id: 'asiansgonewild',
    name: 'r/AsiansGoneWild',
    displayName: 'Asians Gone Wild',
    members: 2200000,
    engagementRate: 8.3,
    category: 'niche',
    verificationRequired: true,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 150,
      minAccountAge: 45,
      titleRequirements: ['[f]', 'verification'],
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Mon 9PM EST', 'Wed 10PM EST', 'Fri 11PM EST'],
    contentPreferences: ['asian', 'amateur', 'authentic'],
    averageUpvotes: 410,
    description: 'Asian creators only, strict verification'
  },
  {
    id: 'latinas',
    name: 'r/latinas',
    displayName: 'Latinas',
    members: 980000,
    engagementRate: 7.5,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 3,
      cooldownHours: 6
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 7PM EST', 'Thu 8PM EST', 'Sun 9PM EST'],
    contentPreferences: ['latina', 'hispanic', 'brazilian'],
    averageUpvotes: 280,
    description: 'For Latina creators'
  },
  {
    id: 'palegirls',
    name: 'r/palegirls',
    displayName: 'Pale Girls',
    members: 780000,
    engagementRate: 8.1,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 75,
      minAccountAge: 21,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 8PM EST', 'Wed 9PM EST', 'Sat 10PM EST'],
    contentPreferences: ['pale', 'fair skin', 'redhead'],
    averageUpvotes: 320,
    description: 'For pale-skinned creators'
  },

  // Body Part Specific
  {
    id: 'boobs',
    name: 'r/boobs',
    displayName: 'Boobs',
    members: 2500000,
    engagementRate: 6.9,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 3,
      cooldownHours: 4
    },
    rules: {
      minKarma: 40,
      minAccountAge: 10,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 7PM-11PM EST'],
    contentPreferences: ['chest', 'topless', 'breasts'],
    averageUpvotes: 220,
    description: 'Breast-focused content'
  },
  {
    id: 'ass',
    name: 'r/ass',
    displayName: 'Ass',
    members: 2800000,
    engagementRate: 7.3,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 3,
      cooldownHours: 5
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 8PM-11PM EST'],
    contentPreferences: ['booty', 'rear view', 'thongs'],
    averageUpvotes: 260,
    description: 'Booty-focused content'
  },
  {
    id: 'feet',
    name: 'r/feet',
    displayName: 'Feet',
    members: 450000,
    engagementRate: 8.7,
    category: 'fetish',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 5,
      cooldownHours: 2
    },
    rules: {
      minKarma: 20,
      minAccountAge: 7,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 6PM-10PM EST'],
    contentPreferences: ['feet', 'toes', 'soles'],
    averageUpvotes: 180,
    description: 'Foot fetish community'
  },

  // Fetish Communities
  {
    id: 'bdsm',
    name: 'r/BDSM',
    displayName: 'BDSM',
    members: 890000,
    engagementRate: 7.1,
    category: 'fetish',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      titleRequirements: ['[F]', '[M]', 'role'],
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Wed 9PM EST', 'Fri 10PM EST', 'Sun 8PM EST'],
    contentPreferences: ['bondage', 'domination', 'submission'],
    averageUpvotes: 210,
    description: 'BDSM and kink community'
  },
  {
    id: 'gothsluts',
    name: 'r/gothsluts',
    displayName: 'Goth Sluts',
    members: 1200000,
    engagementRate: 8.9,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 3,
      cooldownHours: 4
    },
    rules: {
      minKarma: 30,
      minAccountAge: 10,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 8PM EST', 'Thu 9PM EST', 'Sat 11PM EST'],
    contentPreferences: ['goth', 'alternative', 'tattoos', 'piercings'],
    averageUpvotes: 390,
    description: 'Goth and alternative style creators'
  },

  // Age-Specific Communities
  {
    id: 'milf',
    name: 'r/milf',
    displayName: 'MILF',
    members: 1800000,
    engagementRate: 7.6,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 3,
      cooldownHours: 6
    },
    rules: {
      minKarma: 60,
      minAccountAge: 21,
      titleRequirements: ['age 30+'],
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 7PM EST', 'Wed 8PM EST', 'Fri 9PM EST'],
    contentPreferences: ['mature', '30+', 'experienced'],
    averageUpvotes: 310,
    description: 'For mature women 30+'
  },
  {
    id: 'barelylegalteens',
    name: 'r/barelylegalteens',
    displayName: 'Barely Legal Teens',
    members: 950000,
    engagementRate: 8.2,
    category: 'niche',
    verificationRequired: true,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      titleRequirements: ['18-19', 'verification required'],
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 9PM EST', 'Thu 10PM EST', 'Sat 11PM EST'],
    contentPreferences: ['18-19', 'teen', 'young'],
    averageUpvotes: 360,
    description: '18-19 only, strict verification'
  },

  // Couple/Interactive Communities
  {
    id: 'couplesgonewild',
    name: 'r/couplesgonewild',
    displayName: 'Couples Gone Wild',
    members: 1400000,
    engagementRate: 7.9,
    category: 'niche',
    verificationRequired: true,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 150,
      minAccountAge: 45,
      titleRequirements: ['[MF]', '[FF]', '[MM]'],
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Wed 9PM EST', 'Fri 10PM EST', 'Sun 8PM EST'],
    contentPreferences: ['couples', 'interactive', 'together'],
    averageUpvotes: 340,
    description: 'For couples only'
  },

  // More Promotional Communities
  {
    id: 'onlyfansasstastic',
    name: 'r/OnlyFansAsstastic',
    displayName: 'OnlyFans Asstastic',
    members: 680000,
    engagementRate: 6.5,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 4,
      cooldownHours: 3
    },
    rules: {
      minKarma: 15,
      minAccountAge: 5,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 6PM-10PM EST'],
    contentPreferences: ['booty', 'promotional', 'onlyfans'],
    averageUpvotes: 140,
    description: 'Booty-focused OF promotion'
  },
  {
    id: 'onlyfansbusty',
    name: 'r/OnlyFansBusty',
    displayName: 'OnlyFans Busty',
    members: 520000,
    engagementRate: 6.2,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 4,
      cooldownHours: 3
    },
    rules: {
      minKarma: 15,
      minAccountAge: 5,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 6PM-10PM EST'],
    contentPreferences: ['busty', 'promotional', 'onlyfans'],
    averageUpvotes: 125,
    description: 'Busty creators OF promotion'
  },
  {
    id: 'promoteonlyfans',
    name: 'r/PromoteOnlyFans',
    displayName: 'Promote OnlyFans',
    members: 430000,
    engagementRate: 5.8,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 5,
      cooldownHours: 2
    },
    rules: {
      minKarma: 10,
      minAccountAge: 3,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 5PM-11PM EST'],
    contentPreferences: ['promotional', 'links', 'sales'],
    averageUpvotes: 85,
    description: 'Pure promotional subreddit'
  },

  // Additional Niche Communities
  {
    id: 'fitgirls',
    name: 'r/fitgirls',
    displayName: 'Fit Girls',
    members: 890000,
    engagementRate: 7.8,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 75,
      minAccountAge: 21,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 7AM EST', 'Wed 6PM EST', 'Sat 10AM EST'],
    contentPreferences: ['fitness', 'athletic', 'gym'],
    averageUpvotes: 290,
    description: 'Athletic and fit body types'
  },
  {
    id: 'altgonewild',
    name: 'r/altgonewild',
    displayName: 'Alt Gone Wild',
    members: 760000,
    engagementRate: 8.4,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 8PM EST', 'Thu 9PM EST', 'Sun 7PM EST'],
    contentPreferences: ['alternative', 'tattoos', 'piercings', 'colored hair'],
    averageUpvotes: 350,
    description: 'Alternative style creators'
  },
  {
    id: 'curvy',
    name: 'r/curvy',
    displayName: 'Curvy',
    members: 1100000,
    engagementRate: 7.4,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 60,
      minAccountAge: 21,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 8PM EST', 'Wed 9PM EST', 'Fri 10PM EST'],
    contentPreferences: ['curvy', 'voluptuous', 'hourglass'],
    averageUpvotes: 270,
    description: 'Curvy body types'
  },
  {
    id: 'redheads',
    name: 'r/redheads',
    displayName: 'Redheads',
    members: 680000,
    engagementRate: 7.9,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 7PM EST', 'Thu 8PM EST', 'Sun 9PM EST'],
    contentPreferences: ['redhead', 'ginger', 'natural red'],
    averageUpvotes: 300,
    description: 'Natural and dyed redheads'
  },

  // More Fetish Communities
  {
    id: 'femdom',
    name: 'r/femdom',
    displayName: 'Femdom',
    members: 420000,
    engagementRate: 7.6,
    category: 'fetish',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 3,
      cooldownHours: 6
    },
    rules: {
      minKarma: 40,
      minAccountAge: 14,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Wed 8PM EST', 'Fri 9PM EST', 'Sun 7PM EST'],
    contentPreferences: ['domination', 'female led', 'submission'],
    averageUpvotes: 190,
    description: 'Female domination content'
  },
  {
    id: 'girlsfinishingthejob',
    name: 'r/GirlsFinishingTheJob',
    displayName: 'Girls Finishing The Job',
    members: 1300000,
    engagementRate: 8.1,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 1,
      cooldownHours: 24
    },
    rules: {
      minKarma: 200,
      minAccountAge: 60,
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Fri 10PM EST', 'Sat 11PM EST'],
    contentPreferences: ['explicit', 'finishing', 'completion'],
    averageUpvotes: 420,
    description: 'Specific content type, high engagement'
  },

  // Geographic Communities
  {
    id: 'ukgonewild',
    name: 'r/GonewildGBUK',
    displayName: 'UK Gone Wild',
    members: 340000,
    engagementRate: 7.2,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      titleRequirements: ['location optional'],
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 2PM EST', 'Wed 3PM EST', 'Fri 4PM EST'],
    contentPreferences: ['UK', 'British', 'European'],
    averageUpvotes: 180,
    description: 'UK-based creators'
  },
  {
    id: 'australiangonewild',
    name: 'r/GWAustralia',
    displayName: 'Australian Gone Wild',
    members: 280000,
    engagementRate: 7.5,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 40,
      minAccountAge: 14,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Sun 6AM EST', 'Tue 7AM EST', 'Thu 8AM EST'],
    contentPreferences: ['Australian', 'Aussie', 'down under'],
    averageUpvotes: 160,
    description: 'Australian creators'
  },

  // Specialty Content
  {
    id: 'cosplaygirls',
    name: 'r/cosplaygirls',
    displayName: 'Cosplay Girls',
    members: 1600000,
    engagementRate: 6.8,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      titleRequirements: ['character name', 'series'],
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 7PM EST', 'Thu 8PM EST', 'Sun 6PM EST'],
    contentPreferences: ['cosplay', 'costume', 'character'],
    averageUpvotes: 240,
    description: 'Cosplay content only'
  },
  {
    id: 'nsfwcosplay',
    name: 'r/nsfwcosplay',
    displayName: 'NSFW Cosplay',
    members: 890000,
    engagementRate: 7.3,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 3,
      cooldownHours: 6
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      titleRequirements: ['character', 'series'],
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 8PM EST', 'Wed 9PM EST', 'Fri 10PM EST'],
    contentPreferences: ['cosplay', 'lewd', 'costume'],
    averageUpvotes: 280,
    description: 'Adult cosplay content'
  },

  // Additional Premium Communities
  {
    id: 'biggerthanyouthought',
    name: 'r/BiggerThanYouThought',
    displayName: 'Bigger Than You Thought',
    members: 2100000,
    engagementRate: 8.6,
    category: 'premium',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 1,
      cooldownHours: 24
    },
    rules: {
      minKarma: 150,
      minAccountAge: 45,
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Thu 9PM EST', 'Sat 10PM EST'],
    contentPreferences: ['reveal', 'surprise', 'hidden'],
    averageUpvotes: 480,
    description: 'Reveal content, very high engagement'
  },
  {
    id: 'adorableporn',
    name: 'r/adorableporn',
    displayName: 'Adorable Porn',
    members: 1800000,
    engagementRate: 8.2,
    category: 'premium',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Mon 8PM EST', 'Wed 9PM EST', 'Fri 10PM EST'],
    contentPreferences: ['cute', 'adorable', 'sweet'],
    averageUpvotes: 380,
    description: 'Cute and adorable aesthetic'
  },

  // More Specific Niches
  {
    id: 'collegesluts',
    name: 'r/collegesluts',
    displayName: 'College Sluts',
    members: 2400000,
    engagementRate: 7.9,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 3,
      cooldownHours: 6
    },
    rules: {
      minKarma: 50,
      minAccountAge: 14,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 9PM EST', 'Thu 10PM EST', 'Sat 11PM EST'],
    contentPreferences: ['college', 'student', 'dorm'],
    averageUpvotes: 320,
    description: 'College-aged creators'
  },
  {
    id: 'pawg',
    name: 'r/pawg',
    displayName: 'PAWG',
    members: 1900000,
    engagementRate: 8.0,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 75,
      minAccountAge: 21,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Mon 8PM EST', 'Wed 9PM EST', 'Fri 10PM EST'],
    contentPreferences: ['pawg', 'thick', 'white'],
    averageUpvotes: 360,
    description: 'Specific body type niche'
  },
  {
    id: 'workgonewild',
    name: 'r/workgonewild',
    displayName: 'Work Gone Wild',
    members: 680000,
    engagementRate: 8.3,
    category: 'niche',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 1,
      cooldownHours: 24
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Mon 12PM EST', 'Wed 1PM EST', 'Fri 2PM EST'],
    contentPreferences: ['workplace', 'office', 'uniform'],
    averageUpvotes: 310,
    description: 'Workplace-themed content'
  },

  // Final Additions
  {
    id: 'onoff',
    name: 'r/OnOff',
    displayName: 'On/Off',
    members: 1700000,
    engagementRate: 8.4,
    category: 'premium',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 1,
      cooldownHours: 24
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      titleRequirements: ['comparison', 'before/after'],
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Wed 9PM EST', 'Fri 10PM EST', 'Sun 8PM EST'],
    contentPreferences: ['comparison', 'clothed/nude', 'reveal'],
    averageUpvotes: 410,
    description: 'Clothed vs nude comparisons'
  },
  {
    id: 'tittydrop',
    name: 'r/TittyDrop',
    displayName: 'Titty Drop',
    members: 1500000,
    engagementRate: 8.7,
    category: 'premium',
    verificationRequired: false,
    promotionAllowed: 'no',
    postingLimits: {
      perDay: 1,
      cooldownHours: 24
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      titleRequirements: ['OC', 'drop', 'reveal'],
      watermarksAllowed: false,
      sellingAllowed: false
    },
    bestPostingTimes: ['Thu 9PM EST', 'Sat 10PM EST'],
    contentPreferences: ['reveal', 'drop', 'bounce'],
    averageUpvotes: 450,
    description: 'Specific reveal content type'
  },
  {
    id: 'breeding',
    name: 'r/breeding',
    displayName: 'Breeding',
    members: 980000,
    engagementRate: 7.8,
    category: 'fetish',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 8
    },
    rules: {
      minKarma: 75,
      minAccountAge: 21,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Tue 8PM EST', 'Thu 9PM EST', 'Sat 10PM EST'],
    contentPreferences: ['breeding', 'creampie', 'impregnation fantasy'],
    averageUpvotes: 290,
    description: 'Breeding fetish community'
  },
  {
    id: 'slutsofonlyfans',
    name: 'r/SlutsofOnlyFans',
    displayName: 'Sluts of OnlyFans',
    members: 780000,
    engagementRate: 6.4,
    category: 'general',
    verificationRequired: false,
    promotionAllowed: 'yes',
    postingLimits: {
      perDay: 4,
      cooldownHours: 3
    },
    rules: {
      minKarma: 20,
      minAccountAge: 7,
      watermarksAllowed: true,
      sellingAllowed: true
    },
    bestPostingTimes: ['Daily 6PM-11PM EST'],
    contentPreferences: ['promotional', 'explicit', 'onlyfans'],
    averageUpvotes: 150,
    description: 'OnlyFans promotional community'
  },
  {
    id: 'freeuse',
    name: 'r/freeuse',
    displayName: 'Free Use',
    members: 620000,
    engagementRate: 7.5,
    category: 'fetish',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: {
      perDay: 2,
      cooldownHours: 12
    },
    rules: {
      minKarma: 100,
      minAccountAge: 30,
      watermarksAllowed: false,
      sellingAllowed: true
    },
    bestPostingTimes: ['Wed 9PM EST', 'Fri 10PM EST', 'Sun 8PM EST'],
    contentPreferences: ['freeuse', 'casual', 'spontaneous'],
    averageUpvotes: 270,
    description: 'Free use fetish content'
  }
];

// Helper functions for filtering and sorting
export function filterCommunities(filters: {
  verificationRequired?: boolean;
  promotionAllowed?: 'yes' | 'limited' | 'no';
  category?: string;
  minMembers?: number;
  minEngagement?: number;
}): RedditCommunity[] {
  return redditCommunities.filter(community => {
    if (filters.verificationRequired !== undefined && 
        community.verificationRequired !== filters.verificationRequired) {
      return false;
    }
    if (filters.promotionAllowed && 
        community.promotionAllowed !== filters.promotionAllowed) {
      return false;
    }
    if (filters.category && 
        community.category !== filters.category) {
      return false;
    }
    if (filters.minMembers && 
        community.members < filters.minMembers) {
      return false;
    }
    if (filters.minEngagement && 
        community.engagementRate < filters.minEngagement) {
      return false;
    }
    return true;
  });
}

export function sortCommunities(
  communities: RedditCommunity[],
  sortBy: 'members' | 'engagement' | 'averageUpvotes' | 'name'
): RedditCommunity[] {
  return [...communities].sort((a, b) => {
    switch (sortBy) {
      case 'members':
        return b.members - a.members;
      case 'engagement':
        return b.engagementRate - a.engagementRate;
      case 'averageUpvotes':
        return b.averageUpvotes - a.averageUpvotes;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
}

export function getTopCommunities(
  count: number = 10,
  sortBy: 'members' | 'engagement' | 'averageUpvotes' = 'engagement'
): RedditCommunity[] {
  return sortCommunities(redditCommunities, sortBy).slice(0, count);
}

export function getPromotionalCommunities(): RedditCommunity[] {
  return filterCommunities({ promotionAllowed: 'yes' });
}

export function getNoVerificationCommunities(): RedditCommunity[] {
  return filterCommunities({ verificationRequired: false });
}