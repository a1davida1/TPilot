// Pre-generated content templates for free/base tier users
// Organized by category and style for variety

export interface ContentTemplate {
  id: string;
  category: 'teasing' | 'promotional' | 'engagement' | 'lifestyle' | 'announcement';
  style: 'playful' | 'confident' | 'mysterious' | 'casual' | 'direct';
  promotionLevel?: 'none' | 'subtle' | 'moderate' | 'direct';
  subCategory?: 'flash-sale' | 'new-content' | 'discount' | 'exclusive-offer' | 'custom-request' | 'bundle' | 'limited-time';
  title: string;
  content: string;
  tags: string[];
  photoInstructions?: string;
}

export const preGeneratedTemplates: ContentTemplate[] = [
  // Teasing Content
  {
    id: 'tease_001',
    category: 'teasing',
    style: 'playful',
    title: "Guess what I'm wearing underneath? 😏",
    content: "Had the most interesting day today... Started with coffee in my favorite oversized sweater (and maybe nothing else 👀). Been thinking about sharing what happened next. Should I? The full story is waiting for those who know where to find me 💋",
    tags: ['tease', 'playful', 'suggestive'],
    photoInstructions: "Oversized sweater, natural lighting, implied nudity"
  },
  {
    id: 'tease_002',
    category: 'teasing',
    style: 'confident',
    title: "Your favorite girl next door has a secret...",
    content: "They say good girls don't do what I do, but here we are 💅 Just finished a photoshoot that would make your jaw drop. These pics are definitely not for everyone... but maybe they're for you? Link in comments if you're brave enough 🔥",
    tags: ['confident', 'teasing', 'exclusive'],
    photoInstructions: "Confident pose, dramatic lighting, partial reveal"
  },
  {
    id: 'tease_003',
    category: 'teasing',
    style: 'mysterious',
    title: "Something special happened in the shower this morning...",
    content: "Steam, water droplets, and a camera... That's all I'm saying here 🚿 The rest of the story? Well, that's reserved for my special fans. Trust me, you haven't seen anything like this before 💦",
    tags: ['shower', 'mysterious', 'exclusive'],
    photoInstructions: "Steamy bathroom, water droplets, silhouette shots"
  },

  // PROMOTIONAL CONTENT - 50+ VARIATIONS WITH STYLE & PROMOTION MATCHING
  
  // FLASH SALE - Playful Style
  {
    id: 'promo_flash_play_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'moderate',
    subCategory: 'flash-sale',
    title: "Oops! My finger slipped on the discount button 🤭",
    content: "Accidentally made everything 60% off for the next 12 hours! Guess you'll just have to take advantage before I notice my 'mistake' 😇 This month's content theme: 'Pajama Party Gone Wild' - need I say more?",
    tags: ['flash-sale', 'accident', 'playful'],
    photoInstructions: "Cute 'oops' expression, playful pose in pajamas"
  },
  {
    id: 'promo_flash_play_002',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'direct',
    subCategory: 'flash-sale',
    title: "24-hour sale because I'm feeling generous! 💕",
    content: "You've been such good boys and girls, so here's a treat! Everything 50% off until tomorrow midnight. Just dropped my steamiest content yet - bathtub photoshoot that got a little... bubbly 🛁✨",
    tags: ['24hour', 'generous', 'bathtub'],
    photoInstructions: "Bubbly bathtub scene, playful water splashes"
  },
  {
    id: 'promo_flash_play_003',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'subtle',
    subCategory: 'flash-sale',
    title: "Having a weird day... decided to do something crazy 🙈",
    content: "So I woke up feeling a bit rebellious today and thought 'why not make my fans happy?' Next 6 hours only - special pricing on my VIP tier! Fair warning: today's uploads are definitely not safe for work 😘",
    tags: ['rebellious', 'crazy', 'vip'],
    photoInstructions: "Mischievous smile, casual rebellious outfit"
  },

  // FLASH SALE - Confident Style  
  {
    id: 'promo_flash_conf_001',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'direct',
    subCategory: 'flash-sale',
    title: "Flash sale because I know what you want 💪",
    content: "I don't do discounts often, but when I do, it's worth it. 48 hours only - premium content at standard prices. This week's release: 'Power Suit to Birthday Suit' - watch me take control 🔥",
    tags: ['confident', 'premium', 'power'],
    photoInstructions: "Confident power pose, business attire transition"
  },
  {
    id: 'promo_flash_conf_002',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'moderate',
    subCategory: 'flash-sale',
    title: "Your favorite content creator just got more affordable",
    content: "Quality doesn't usually go on sale, but here we are 💅 Limited 36-hour window for my exclusive tier. Recent theme: 'Mirror Mirror' - where I explore every angle and you get the best view in the house",
    tags: ['quality', 'exclusive', 'mirror'],
    photoInstructions: "Multiple mirror angles, confident poses"
  },
  {
    id: 'promo_flash_conf_003',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'subtle',
    subCategory: 'flash-sale',
    title: "Rare opportunity - don't overthink it",
    content: "I rarely do promotions, but this week's content deserves a special introduction. Short-time pricing adjustment on my premium gallery. Subject matter: 'Silk and Shadows' - artistic nude photography that pushes boundaries",
    tags: ['rare', 'artistic', 'boundaries'],
    photoInstructions: "Artistic nude silhouettes, silk fabrics"
  },

  // FLASH SALE - Mysterious Style
  {
    id: 'promo_flash_myst_001',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'moderate',
    subCategory: 'flash-sale',
    title: "Something special happens at midnight... 🌙",
    content: "For the next 24 hours, access to my hidden vault is half price. Content you won't find anywhere else - shadows, candlelight, and secrets I've been keeping. Only for those who truly appreciate art 🕯️",
    tags: ['midnight', 'vault', 'candlelight'],
    photoInstructions: "Candlelit scenes, mysterious shadows, artistic mood"
  },
  {
    id: 'promo_flash_myst_002',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'direct',
    subCategory: 'flash-sale',
    title: "The vault opens... briefly 🗝️",
    content: "Once a month I unlock my most exclusive content. Tonight is that night. 40% reduction for early access to 'Behind Closed Doors' collection. Warning: not for the faint of heart 💀",
    tags: ['vault', 'monthly', 'exclusive'],
    photoInstructions: "Dark, intimate settings behind doors"
  },
  {
    id: 'promo_flash_myst_003',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'subtle',
    subCategory: 'flash-sale',
    title: "Midnight whispers... sale until dawn 🌃",
    content: "Some of my most intimate content is on sale until sunrise. The 'Moonlight Confessions' collection - where shadows dance and secrets are shared. Not for everyone... but perhaps for you.",
    tags: ['midnight', 'moonlight', 'confessions'],
    photoInstructions: "Moonlit scenes, intimate shadows, whispered secrets"
  },

  // FLASH SALE - Casual & Direct Styles
  {
    id: 'promo_flash_cas_001',
    category: 'promotional',
    style: 'casual',
    promotionLevel: 'moderate',
    subCategory: 'flash-sale',
    title: "Lazy Sunday sale - because we all deserve treats 🍰",
    content: "Sunday funday pricing! 35% off while you're lounging around. Perfect timing for my 'Sunday Silk' series - what happens when silk pajamas meet Sunday morning light? Come find out!",
    tags: ['sunday', 'lazy', 'silk'],
    photoInstructions: "Sunday morning in silk pajamas, soft natural light"
  },
  {
    id: 'promo_flash_dir_001',
    category: 'promotional',
    style: 'direct',
    promotionLevel: 'direct',
    subCategory: 'flash-sale',
    title: "48-hour flash sale - no games, just results",
    content: "Straightforward offer: 55% off all premium content for exactly 48 hours. This includes my latest 'Boardroom Confessions' series - professional by day, wild by night. Timer starts now.",
    tags: ['48hour', 'straightforward', 'boardroom'],
    photoInstructions: "Professional boardroom transition to wild"
  },

  // NEW CONTENT - All Styles
  {
    id: 'promo_new_play_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'moderate',
    subCategory: 'new-content',
    title: "Just finished the most fun photoshoot ever! 📸",
    content: "Spent all weekend creating something amazing - 100+ pics of pure playfulness! Theme was 'Pillow Fight Gone Wrong' and let's just say... not much stayed on 🙊 Available now for subscribers!",
    tags: ['weekend', 'pillow-fight', 'playful'],
    photoInstructions: "Pillow fight scene, playful chaos, minimal clothing"
  },
  {
    id: 'promo_new_play_002', 
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'direct',
    subCategory: 'new-content',
    title: "200+ new pics dropped! Your Tuesday just got better 🎉",
    content: "Biggest content release yet! Spent three days shooting 'Gaming Girl Gets Naughty' series. Spoiler alert: I lose every game but you definitely win 🎮 Full collection available now!",
    tags: ['biggest', 'gaming', 'naughty'],
    photoInstructions: "Gaming setup with playful undressing sequence"
  },
  {
    id: 'promo_new_conf_001',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'direct',
    subCategory: 'new-content',
    title: "New content series: Unleashed 🔥",
    content: "You asked for bolder content. I delivered. 'Unleashed' is my most daring series yet - 150+ photos where I hold nothing back. This isn't just content, it's an experience. Available exclusively for VIP members.",
    tags: ['unleashed', 'bolder', 'daring'],
    photoInstructions: "Bold, daring poses, confident expressions"
  },
  {
    id: 'promo_new_conf_002',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'moderate',
    subCategory: 'new-content',
    title: "Fresh content: Power & Passion collection",
    content: "Combining strength with sensuality in my latest 80-photo series. Professional studio lighting meets raw passion. This collection showcases a side of me you haven't seen before 💪",
    tags: ['power', 'passion', 'studio'],
    photoInstructions: "Professional studio lighting, powerful poses"
  },
  {
    id: 'promo_new_myst_001',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'direct',
    subCategory: 'new-content',
    title: "The forbidden gallery is now open 🚪",
    content: "Content I never thought I'd share... until now. 'Forbidden Desires' collection - 300+ photos exploring themes that push every boundary. This content exists in the shadows for a reason.",
    tags: ['forbidden', 'shadows', 'boundaries'],
    photoInstructions: "Dark, forbidden themes, boundary-pushing content"
  },
  {
    id: 'promo_new_cas_001',
    category: 'promotional',
    style: 'casual',
    promotionLevel: 'moderate',
    subCategory: 'new-content',
    title: "Fresh content drop - 'Girl Next Door Undressed' 🏠",
    content: "Ever wonder what the sweet girl next door does when no one's watching? Wonder no more! 150+ photos showing my true colors. Spoiler: they're much more vibrant than anyone expected 🌈",
    tags: ['girl-next-door', 'true-colors', 'vibrant'],
    photoInstructions: "Girl-next-door to revealing transformation"
  },
  {
    id: 'promo_new_dir_001',
    category: 'promotional',
    style: 'direct',
    promotionLevel: 'direct',
    subCategory: 'new-content',
    title: "New content available: 'Executive After Hours' series",
    content: "Professional content for discerning viewers. 120+ high-quality images documenting what happens when the office closes and inhibitions open. Premium tier members get immediate access.",
    tags: ['executive', 'after-hours', 'professional'],
    photoInstructions: "Executive office after-hours scenarios"
  },

  // DISCOUNT PROMOTIONS - All Styles
  {
    id: 'promo_disc_cas_001',
    category: 'promotional',
    style: 'casual',
    promotionLevel: 'moderate',
    subCategory: 'discount',
    title: "Hey loves! Surprise discount just for you 💕",
    content: "You've been so supportive lately, I wanted to do something nice! 30% off everything for the next week. Just uploaded my 'Cozy Sunday Morning' series - coffee, curves, and comfort 😊",
    tags: ['supportive', 'cozy', 'morning'],
    photoInstructions: "Cozy morning setting with coffee, natural light"
  },
  {
    id: 'promo_disc_cas_002',
    category: 'promotional',
    style: 'casual',
    promotionLevel: 'direct',
    subCategory: 'discount',
    title: "Mid-week special - because why not? 🌸",
    content: "Feeling generous this Wednesday! Everything 40% off until Friday. Perfect timing since I just added 'Yoga Flow' content - flexibility has never looked so good 🧘‍♀️",
    tags: ['midweek', 'yoga', 'flexibility'],
    photoInstructions: "Yoga poses, flexible positions, athletic wear"
  },
  {
    id: 'promo_disc_conf_001',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'direct',
    subCategory: 'discount',
    title: "Quality content, quality discount - 50% off everything",
    content: "I don't compromise on content quality, but I can compromise on price. This week only - half off my entire catalog. Recent addition: 'Executive Suite' series where power meets passion in corporate America.",
    tags: ['quality', 'executive', 'corporate'],
    photoInstructions: "Executive office settings, power suits, corporate seduction"
  },
  {
    id: 'promo_disc_myst_001',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'subtle',
    subCategory: 'discount',
    title: "Rare price adjustment... take advantage 💫",
    content: "My content rarely goes on sale, but this week is different. 25% reduction on exclusive tiers - a chance to explore content that usually remains hidden. The 'Velvet Underground' awaits.",
    tags: ['rare', 'exclusive', 'velvet-underground'],
    photoInstructions: "Underground velvet themes, exclusive hidden content"
  },
  {
    id: 'promo_disc_play_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'moderate',
    subCategory: 'discount',
    title: "Oops! Did I accidentally make everything cheaper? 😅",
    content: "Clumsy me must have hit the wrong button! Everything's mysteriously 45% off for the next few days. Hope nobody notices... especially not after seeing my new 'Bubble Bath Bloopers' series! 🛁💦",
    tags: ['accidental', 'bubble-bath', 'bloopers'],
    photoInstructions: "Bubble bath with playful mishaps and splashing"
  },

  // EXCLUSIVE OFFERS - All Styles
  {
    id: 'promo_excl_dir_001',
    category: 'promotional',
    style: 'direct',
    promotionLevel: 'direct',
    subCategory: 'exclusive-offer',
    title: "VIP membership special - limited slots available",
    content: "Opening 25 VIP slots this month. Includes: weekly custom content, direct messaging, and exclusive behind-the-scenes access. VIP members see everything first, including my 'After Dark' collection launching next week.",
    tags: ['vip', 'limited', 'behind-scenes'],
    photoInstructions: "VIP exclusive content, luxurious settings"
  },
  {
    id: 'promo_excl_conf_001',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'moderate',
    subCategory: 'exclusive-offer',
    title: "Exclusive tier access - for serious collectors only",
    content: "Premium tier unlocked for qualified subscribers. Includes unreleased content from my private collection plus monthly video calls. Current featured series: 'Private Dancer' - intimate performances created exclusively for this tier.",
    tags: ['premium', 'unreleased', 'private-dancer'],
    photoInstructions: "Intimate dance poses, private performance setting"
  },
  {
    id: 'promo_excl_myst_001',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'subtle',
    subCategory: 'exclusive-offer',
    title: "The inner circle expands... slightly 🌟",
    content: "A few select individuals will gain access to content that exists beyond the public eye. The 'Inner Circle' tier includes material I've never shared... and probably never should. Applications reviewed personally.",
    tags: ['inner-circle', 'select', 'beyond'],
    photoInstructions: "Exclusive inner circle themes, selective content"
  },
  {
    id: 'promo_excl_play_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'moderate',
    subCategory: 'exclusive-offer',
    title: "Secret club membership now open! 🤫",
    content: "Psst... want to join my secret club? Limited memberships available! Club perks include: surprise content drops, silly behind-the-scenes clips, and access to my 'Pillow Fort Confessions' series. First rule of secret club? Have fun! 🏰",
    tags: ['secret-club', 'surprise', 'pillow-fort'],
    photoInstructions: "Secret club theme with pillow forts and playful scenes"
  },

  // BUNDLE DEALS - Multiple Styles
  {
    id: 'promo_bundle_play_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'moderate',
    subCategory: 'bundle',
    title: "Bundle bonanza! Everything you want in one package 📦",
    content: "Why choose when you can have it all? Photo sets + videos + custom messages bundled together! This month's theme pack: 'Schoolgirl Secrets' - 200+ pics, 10 videos, daily messages 🎀",
    tags: ['bundle', 'everything', 'schoolgirl'],
    photoInstructions: "School theme outfit, innocent to naughty transition"
  },
  {
    id: 'promo_bundle_conf_001',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'direct',
    subCategory: 'bundle',
    title: "Complete collection bundle - everything I've shot",
    content: "Access to my entire catalog in one purchase. 2000+ photos, 100+ videos, exclusive content spanning 2 years. This is my life's work made available to serious collectors only.",
    tags: ['complete', 'catalog', 'collectors'],
    photoInstructions: "Portfolio showcase, variety of professional shots"
  },
  {
    id: 'promo_bundle_mega_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'direct',
    subCategory: 'bundle',
    title: "MEGA BUNDLE ALERT! 🚨 Everything + kitchen sink!",
    content: "This is insane but I'm doing it anyway! EVERY photo, EVERY video, EVERY message, PLUS upcoming content for next 3 months - all for one price! 'Kitchen Sink' bundle because literally everything is included! 🤪",
    tags: ['mega', 'everything', 'insane'],
    photoInstructions: "Overwhelming variety, everything included theme"
  },

  // CUSTOM REQUEST PROMOTIONS
  {
    id: 'promo_custom_myst_001',
    category: 'promotional',
    style: 'mysterious',
    promotionLevel: 'subtle',
    subCategory: 'custom-request',
    title: "Custom content slots opening soon... 🎭",
    content: "Five exclusive custom commission slots available this month. Bring me your fantasies and watch them come to life through my lens. Previous commissions include themes I never imagined... but loved creating 🖤",
    tags: ['custom', 'fantasies', 'commissions'],
    photoInstructions: "Artistic custom scenarios, creative lighting"
  },
  {
    id: 'promo_custom_cas_001',
    category: 'promotional',
    style: 'casual',
    promotionLevel: 'moderate',
    subCategory: 'custom-request',
    title: "Taking custom requests - your ideas welcome! 💭",
    content: "Love hearing what you'd like to see! Opening custom request spots for next month. Whether it's a specific outfit, theme, or scenario - let's make it happen together! Past favorites: retro pin-up and rainy day romance 🌧️",
    tags: ['custom-requests', 'ideas', 'scenarios'],
    photoInstructions: "Various custom scenarios, retro and romantic themes"
  },
  {
    id: 'promo_custom_conf_001',
    category: 'promotional',
    style: 'confident',
    promotionLevel: 'direct',
    subCategory: 'custom-request',
    title: "Premium custom content - bring your vision to life",
    content: "High-end custom photography sessions now available. Professional lighting, multiple outfits, and your creative direction. Minimum 50-photo delivery with editing included. Limited slots per month for quality assurance.",
    tags: ['premium-custom', 'professional', 'vision'],
    photoInstructions: "High-end professional custom photography setups"
  },

  // LIMITED TIME OFFERS
  {
    id: 'promo_limited_dir_001',
    category: 'promotional',
    style: 'direct',
    promotionLevel: 'direct',
    subCategory: 'limited-time',
    title: "72 hours only - then it's gone forever",
    content: "This offer disappears Sunday night. Premium access at basic rates, plus exclusive unreleased content from my 'Red Room' sessions. This deal won't repeat - secure your access now.",
    tags: ['72hours', 'forever', 'red-room'],
    photoInstructions: "Red-themed room, dramatic lighting, premium content"
  },
  {
    id: 'promo_limited_play_001',
    category: 'promotional',
    style: 'playful',
    promotionLevel: 'moderate', 
    subCategory: 'limited-time',
    title: "Weekend warriors get special treatment! ⚔️",
    content: "Saturday to Sunday only - warrior discount activated! 45% off all tiers because weekends should be for fun. Just released 'Cosplay Chronicles' - guess which character made me blush the most 😊",
    tags: ['weekend', 'warriors', 'cosplay'],
    photoInstructions: "Various cosplay outfits, character transformations"
  },
  {
    id: 'promo_limited_final_001',
    category: 'promotional',
    style: 'direct',
    promotionLevel: 'direct',
    subCategory: 'limited-time',
    title: "Last call - final 24 hours for premium access",
    content: "This opportunity ends tomorrow at midnight. Premium tier access at 60% off, including immediate access to my private 'After Hours' collection. No extensions, no repeats. Secure your access now or wait until next year.",
    tags: ['last-call', 'final', 'after-hours'],
    photoInstructions: "Final opportunity theme, after-hours intimate content"
  },

  // Engagement Content
  {
    id: 'engage_001',
    category: 'engagement',
    style: 'casual',
    title: "What's your biggest fantasy? I might just make it happen...",
    content: "Feeling creative today and want to hear from you! 💭 Drop your wildest ideas in the comments - I'm picking my favorites for next week's content. The most creative suggestion gets a special surprise in their DMs 😘",
    tags: ['interactive', 'engagement', 'community'],
    photoInstructions: "Inviting pose, direct eye contact, warm lighting"
  },
  {
    id: 'engage_002',
    category: 'engagement',
    style: 'confident',
    title: "Rate my outfit... or what's left of it 😏",
    content: "Started the day fully dressed, but somehow pieces keep disappearing 🤷‍♀️ Currently at stage 3 of 5... Should I keep going? Your votes decide! Plus, everyone who interacts gets a special preview of the final result 🔥",
    tags: ['interactive', 'voting', 'striptease'],
    photoInstructions: "Progressive undressing, confident poses"
  },
  {
    id: 'engage_003',
    category: 'engagement',
    style: 'playful',
    title: "Truth or dare? I pick dare... always 😈",
    content: "It's Friday and I'm feeling adventurous! Leave your dares in the comments - nothing's off limits (well, almost nothing 😉). Top 3 dares will be fulfilled and documented for my VIP members. Let's see how creative you can get!",
    tags: ['game', 'dare', 'friday'],
    photoInstructions: "Mischievous expression, playful setting"
  },

  // Lifestyle Content
  {
    id: 'life_001',
    category: 'lifestyle',
    style: 'casual',
    title: "Sunday vibes: Coffee, sunshine, and absolutely no clothes",
    content: "Perfect morning = coffee in bed, sunlight through the windows, and complete freedom 🌞 This is your reminder that self-care Sundays are important! How are you spending yours? (Mine involves a camera and some very artistic angles 📸)",
    tags: ['sunday', 'lifestyle', 'natural'],
    photoInstructions: "Natural morning light, relaxed poses, coffee prop"
  },
  {
    id: 'life_002',
    category: 'lifestyle',
    style: 'confident',
    title: "Gym gains and other assets 🍑",
    content: "Leg day hit different today! 🏋️‍♀️ All this hard work is paying off in ways you can definitely appreciate. New gym content dropping tomorrow - sports bras were optional, results were mandatory 💪",
    tags: ['fitness', 'gym', 'body'],
    photoInstructions: "Athletic wear, gym setting, focus on physique"
  },
  {
    id: 'life_003',
    category: 'lifestyle',
    style: 'playful',
    title: "Cooking dinner... outfit optional 👩‍🍳",
    content: "They say the way to someone's heart is through their stomach, but I have other ideas 😏 Tonight's menu: Something spicy in the kitchen (and I'm not talking about the food). Who wants the recipe? 🌶️",
    tags: ['cooking', 'domestic', 'playful'],
    photoInstructions: "Kitchen setting, apron only, playful cooking poses"
  },

  // Announcement Content
  {
    id: 'announce_001',
    category: 'announcement',
    style: 'direct',
    title: "Big news! Taking custom requests this week 📣",
    content: "You asked, I listened! Opening up custom content slots for this week only. Whether it's a specific outfit, scenario, or that thing you've been too shy to ask for... Now's your chance! Limited spots available 💫",
    tags: ['custom', 'announcement', 'limited'],
    photoInstructions: "Professional announcement style, eye-catching"
  },
  {
    id: 'announce_002',
    category: 'announcement',
    style: 'playful',
    title: "I did something I've never done before... 🙈",
    content: "You know that thing everyone's been asking me to try? Well... I finally did it! 🎉 And wow, you're going to love the results. This is definitely my most requested content ever. Available now for my VIP members!",
    tags: ['new', 'requested', 'exclusive'],
    photoInstructions: "Excited expression, celebratory mood"
  },
  {
    id: 'announce_003',
    category: 'announcement',
    style: 'mysterious',
    title: "Midnight drop... Set your alarms 🌙",
    content: "Something special is happening at midnight tonight. I can't say much, but it involves lingerie, candlelight, and a surprise guest 👀 Only my subscribers will get the notification. Don't miss this...",
    tags: ['midnight', 'surprise', 'exclusive'],
    photoInstructions: "Dark, moody lighting with hints of lingerie"
  },

  // More variety for free tier
  {
    id: 'variety_001',
    category: 'teasing',
    style: 'confident',
    title: "Mirror selfies hit different at 2am",
    content: "Couldn't sleep, so I decided to have a little photoshoot 📸 The mirror never lies, and tonight it's showing all my best angles. Want to see what's keeping me up? Check my profile for the full album 💋",
    tags: ['mirror', 'selfie', 'latenight'],
    photoInstructions: "Mirror selfies, dim lighting, various angles"
  },
  {
    id: 'variety_002',
    category: 'promotional',
    style: 'playful',
    title: "Whoops, my subscription price slipped! 📉",
    content: "Clumsy me accidentally dropped my prices by 50%! 🙊 Guess you'll just have to take advantage before I notice... This month's content theme: 'Too Hot for TikTok'. Need I say more?",
    tags: ['discount', 'accident', 'hot'],
    photoInstructions: "Playful 'oops' expression, flirty pose"
  },
  {
    id: 'variety_003',
    category: 'engagement',
    style: 'direct',
    title: "Be honest - am I your type?",
    content: "Curious minds want to know! 💭 Drop a ❤️ if I'm your type, or tell me what would make me perfect for you. Most interesting answer gets a special surprise in their inbox...",
    tags: ['question', 'type', 'interaction'],
    photoInstructions: "Direct gaze, confident stance, alluring outfit"
  },

  // SHOWER SCENE TEMPLATES - Natural & Engaging
  {
    id: 'shower_001',
    category: 'lifestyle',
    style: 'playful',
    title: "Just got out of the shower and feeling amazing",
    content: "There's something about that post-shower glow that just hits different ✨ Fresh, clean, and ready to take on the world. Hope everyone's having a beautiful day!",
    tags: ['shower', 'fresh', 'glow', 'lifestyle'],
    photoInstructions: "Post-shower glow, natural lighting, towel or robe"
  },
  {
    id: 'shower_002',
    category: 'lifestyle',
    style: 'casual',
    title: "Steam and good vibes only",
    content: "Nothing beats a hot shower after a long day. The steam, the warmth, the moment of peace... it's like hitting the reset button on life ☁️",
    tags: ['steam', 'relaxation', 'reset', 'selfcare'],
    photoInstructions: "Steamy bathroom, soft lighting, relaxed expression"
  },
  {
    id: 'shower_003',
    category: 'lifestyle',
    style: 'confident',
    title: "Golden hour shower = perfect timing",
    content: "Caught the most beautiful light streaming through the bathroom window during my evening shower. Sometimes the universe just gets the timing right ✨",
    tags: ['golden-hour', 'perfect-timing', 'natural-light'],
    photoInstructions: "Golden hour lighting through window, warm tones"
  },
  {
    id: 'shower_004',
    category: 'lifestyle',
    style: 'casual',
    title: "Taking my time with my evening routine",
    content: "No rush tonight. Just me, hot water, and my favorite playlist. These quiet moments are everything 🎵",
    tags: ['evening-routine', 'quiet-moments', 'selfcare'],
    photoInstructions: "Relaxed shower scene, peaceful atmosphere"
  },
  {
    id: 'shower_005',
    category: 'lifestyle',
    style: 'playful',
    title: "That feeling when the water temperature is just right",
    content: "You know that perfect moment when you get the water temperature exactly right? That's where I'm at right now and I'm not moving 😌",
    tags: ['perfect-temperature', 'comfort', 'bliss'],
    photoInstructions: "Content expression, steam, comfortable shower setting"
  },
  {
    id: 'shower_006',
    category: 'teasing',
    style: 'mysterious',
    title: "Some of my best thinking happens in the shower",
    content: "Something about the sound of water and the steam just clears my mind... and gives me the most interesting ideas 💭",
    tags: ['shower-thoughts', 'mysterious', 'contemplative'],
    photoInstructions: "Thoughtful pose, steamy atmosphere, artistic shots"
  },
  {
    id: 'shower_007',
    category: 'lifestyle',
    style: 'casual',
    title: "Starting the day with good energy",
    content: "Morning showers just hit different. Washing away yesterday and getting ready for whatever today brings ☀️",
    tags: ['morning-shower', 'fresh-start', 'positive-energy'],
    photoInstructions: "Bright morning light, energetic vibe, fresh look"
  },
  {
    id: 'shower_008',
    category: 'lifestyle',
    style: 'confident',
    title: "Self-care Sunday done right",
    content: "Extended everything today - longer shower, better products, extra time for me. This is what Sundays are for 💆‍♀️",
    tags: ['self-care-sunday', 'extended-routine', 'pampering'],
    photoInstructions: "Luxurious bathroom setting, self-care products visible"
  },
  {
    id: 'shower_009',
    category: 'lifestyle',
    style: 'playful',
    title: "When you find the perfect shower playlist",
    content: "Currently having my own private concert in here and the acoustics are incredible 🎤 Who else sings in the shower?",
    tags: ['shower-singing', 'music', 'fun'],
    photoInstructions: "Playful singing pose, shower setting, joyful expression"
  },
  {
    id: 'shower_010',
    category: 'teasing',
    style: 'confident',
    title: "The steam is perfect for mysterious photos",
    content: "There's something about steamy mirrors and soft lighting that creates the most beautiful shots... just saying 📸",
    tags: ['steamy-mirrors', 'artistic', 'photography'],
    photoInstructions: "Steamy mirror reflections, artistic composition, soft focus"
  },
  {
    id: 'shower_011',
    category: 'lifestyle',
    style: 'casual',
    title: "Taking a moment to appreciate the little things",
    content: "Hot water, good lighting, and nowhere else to be. Sometimes the simplest moments are the best ones 🌿",
    tags: ['gratitude', 'simple-moments', 'mindfulness'],
    photoInstructions: "Peaceful expression, natural elements, serene atmosphere"
  },
  {
    id: 'shower_012',
    category: 'lifestyle',
    style: 'playful',
    title: "That post-workout shower feeling",
    content: "Nothing beats washing off a good workout. Feeling strong, clean, and ready for whatever's next 💪",
    tags: ['post-workout', 'strength', 'accomplishment'],
    photoInstructions: "Athletic aesthetic, post-exercise glow, confident pose"
  },
  {
    id: 'shower_013',
    category: 'teasing',
    style: 'mysterious',
    title: "Some moments are too beautiful not to capture",
    content: "The light, the steam, the way everything comes together... had to document this perfect moment ✨",
    tags: ['perfect-moment', 'beautiful', 'artistic'],
    photoInstructions: "Artistic composition, perfect lighting, aesthetic appeal"
  },
  {
    id: 'shower_014',
    category: 'lifestyle',
    style: 'confident',
    title: "Taking my time because I deserve it",
    content: "No rushing today. This is my time, my space, my moment of peace. We all need these little luxuries 🛁",
    tags: ['taking-time', 'deserving', 'luxury'],
    photoInstructions: "Luxurious bathroom setting, confident pose, self-assured expression"
  },
  {
    id: 'shower_015',
    category: 'lifestyle',
    style: 'casual',
    title: "The universe gave me perfect lighting today",
    content: "Sometimes everything just aligns - the time, the light, the mood. Today was one of those days 🌅",
    tags: ['perfect-lighting', 'alignment', 'serendipity'],
    photoInstructions: "Beautiful natural lighting, perfect timing capture"
  },
  {
    id: 'shower_016',
    category: 'teasing',
    style: 'playful',
    title: "Creating some magic behind the curtain",
    content: "They say the best things happen when no one's watching... but maybe just this once, someone should be 😉",
    tags: ['behind-curtain', 'magic', 'playful-tease'],
    photoInstructions: "Shower curtain silhouettes, playful shadows, teasing composition"
  },
  {
    id: 'shower_017',
    category: 'lifestyle',
    style: 'casual',
    title: "Finding peace in the everyday moments",
    content: "It's amazing how something as simple as a shower can feel like meditation. Water therapy is real 🧘‍♀️",
    tags: ['meditation', 'water-therapy', 'peace'],
    photoInstructions: "Meditative pose, tranquil water, peaceful atmosphere"
  },
  {
    id: 'shower_018',
    category: 'lifestyle',
    style: 'confident',
    title: "Treating myself to an extra-long shower today",
    content: "Sometimes you need to be generous with yourself. Today that means unlimited hot water and no time limits ⏰",
    tags: ['generous-self-care', 'unlimited', 'indulgence'],
    photoInstructions: "Indulgent bathroom setting, relaxed confidence, luxury feel"
  },
  {
    id: 'shower_019',
    category: 'teasing',
    style: 'mysterious',
    title: "The best views happen when you're not looking for them",
    content: "Wasn't planning on taking photos today, but sometimes the moment is too perfect to pass up... 📷",
    tags: ['spontaneous', 'perfect-moment', 'unexpected'],
    photoInstructions: "Candid-style shot, natural spontaneous pose, perfect timing"
  },
  {
    id: 'shower_020',
    category: 'lifestyle',
    style: 'playful',
    title: "Living my best life one shower at a time",
    content: "If this is self-care, I'm doing it right. Hot water, good vibes, and absolutely no worries allowed 🚫😤",
    tags: ['best-life', 'no-worries', 'good-vibes'],
    photoInstructions: "Carefree expression, joyful energy, positive atmosphere"
  },
  {
    id: 'shower_021',
    category: 'lifestyle',
    style: 'casual',
    title: "Sometimes you need to wash more than just your hair",
    content: "Washing away the stress, the doubts, the long day... emerging feeling like a completely new person ✨",
    tags: ['washing-stress', 'renewal', 'transformation'],
    photoInstructions: "Transformative lighting, renewal theme, fresh perspective"
  },
  {
    id: 'shower_022',
    category: 'teasing',
    style: 'confident',
    title: "Creating art with steam and shadows",
    content: "Who knew a bathroom could become a photography studio? The right light and a little creativity goes a long way 🎨",
    tags: ['art-creation', 'creativity', 'photography'],
    photoInstructions: "Artistic shadows, creative composition, professional quality"
  },
  {
    id: 'shower_023',
    category: 'lifestyle',
    style: 'casual',
    title: "This is what happiness looks like",
    content: "Simple moments, perfect temperature, and nowhere else I'd rather be. Sometimes happiness is just hot water and peace ☮️",
    tags: ['happiness', 'simple-moments', 'contentment'],
    photoInstructions: "Genuine happiness, peaceful contentment, natural joy"
  },
  {
    id: 'shower_024',
    category: 'lifestyle',
    style: 'confident',
    title: "Making the ordinary feel extraordinary",
    content: "Same shower, same routine, but today feels different. Maybe it's the lighting, maybe it's my mood, maybe it's both ✨",
    tags: ['extraordinary-ordinary', 'mood', 'transformation'],
    photoInstructions: "Elevated everyday moment, special atmosphere, confident energy"
  },
  {
    id: 'shower_025',
    category: 'teasing',
    style: 'playful',
    title: "Some secrets are worth keeping... almost",
    content: "What happens in the shower usually stays in the shower, but today might be an exception... if you're lucky 🍀",
    tags: ['secrets', 'exceptions', 'lucky'],
    photoInstructions: "Mysterious but playful, teasing composition, hint of revelation"
  }
];

// Function to get random templates based on criteria
export function getRandomTemplates(
  count: number = 3,
  category?: string,
  style?: string,
  promotionLevel?: string,
  subCategory?: string
): ContentTemplate[] {
  let filtered = [...preGeneratedTemplates];
  
  if (category) {
    filtered = filtered.filter(t => t.category === category);
  }
  
  if (style) {
    filtered = filtered.filter(t => t.style === style);
  }
  
  if (promotionLevel) {
    filtered = filtered.filter(t => (t as any).promotionLevel === promotionLevel || !t.hasOwnProperty('promotionLevel'));
  }
  
  if (subCategory) {
    filtered = filtered.filter(t => (t as any).subCategory === subCategory);
  }
  
  // Prioritize exact matches, then partial matches
  const exactMatches = filtered.filter(t => 
    (!category || t.category === category) &&
    (!style || t.style === style) &&
    (!promotionLevel || (t as any).promotionLevel === promotionLevel)
  );
  
  const results = exactMatches.length >= count ? exactMatches : [...exactMatches, ...filtered];
  
  // Shuffle and return requested count
  const shuffled = results.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Function to add watermark text to free tier content
export function addWatermark(content: string, isTitle: boolean = false): string {
  const watermark = " [via ThottoPilot]";
  
  if (isTitle) {
    return content + watermark;
  }
  
  // For body content, add at the end
  return content + "\n\n" + "Created with ThottoPilot - Premium for watermark-free content";
}

// Get template by specific criteria
export function getTemplateByMood(
  mood: 'playful' | 'confident' | 'mysterious' | 'casual' | 'direct'
): ContentTemplate | null {
  const templates = preGeneratedTemplates.filter(t => t.style === mood);
  if (templates.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
}

// Get trending templates (simulate based on mock engagement data)
export function getTrendingTemplates(count: number = 5): ContentTemplate[] {
  // In production, this would pull from analytics
  // For now, return templates with 'hot', 'trending', or 'viral' tags
  const trending = preGeneratedTemplates.filter(t => 
    t.tags.some(tag => ['sale', 'discount', 'exclusive', 'limited'].includes(tag))
  );
  
  return trending.slice(0, count);
}