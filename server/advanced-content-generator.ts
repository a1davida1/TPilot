// Advanced Content Generation Engine
// Produces authentically different content based on all user parameters

export interface ContentParameters {
  photoType: 'casual' | 'workout' | 'shower' | 'showing-skin' | 'spicy' | 'very-spicy' | 'all-xs';
  textTone: 'confident' | 'playful' | 'mysterious' | 'authentic' | 'sassy';
  style: string; // style preset like 'nude-photos', 'shower-content', etc.
  includePromotion: boolean;
  selectedHashtags: string[];
  customPrompt?: string;
  platform: string;
}

export interface GeneratedContent {
  titles: string[];
  content: string;
  photoInstructions: {
    lighting: string;
    angles: string;
    composition: string;
    styling: string;
    technical: string;
    sceneSetup: string;
  };
  tags: string[];
}

// Photo Type Specific Content Variations
const photoTypeVariations = {
  'teasing': {
    themes: ['playful tease', 'subtle hint', 'flirty suggestion', 'mysterious allure', 'coy moment'],
    settings: ['bedroom door', 'mirror selfie', 'cozy couch', 'bath time', 'morning bed'],
    clothing: ['oversized shirt', 'silk robe', 'cute lingerie peek', 'towel wrap', 'strategic coverage'],
    lighting: 'Soft intimate lighting, warm candlelight, sunset glow',
    angles: 'Teasing glimpses, over-shoulder looks, partial reveals',
    mood: 'playful and teasing'
  },
  'behind-scenes': {
    themes: ['getting ready', 'makeup process', 'outfit selection', 'photoshoot prep', 'content creation'],
    settings: ['vanity mirror', 'wardrobe area', 'makeup station', 'photo setup', 'behind camera'],
    clothing: ['robe and lingerie', 'getting dressed', 'outfit changes', 'casual prep wear'],
    lighting: 'Natural backstage lighting, mirror lights, behind-the-scenes authenticity',
    angles: 'Candid preparation shots, mirror reflections, process documentation',
    mood: 'authentic and intimate'
  },
  'outfit': {
    themes: ['outfit reveal', 'fashion show', 'style showcase', 'wardrobe tour', 'clothing haul'],
    settings: ['bedroom mirror', 'dressing room', 'closet area', 'fashion backdrop', 'outfit display'],
    clothing: ['multiple outfits', 'lingerie sets', 'dress collection', 'style variations'],
    lighting: 'Bright fashion lighting, clear visibility, flattering angles',
    angles: 'Full body shots, detail close-ups, 360 turns, outfit transitions',
    mood: 'fashionable and stylish'
  },
  'lifestyle': {
    themes: ['daily routine', 'home life', 'relaxation', 'self-care', 'personal moments'],
    settings: ['living space', 'kitchen area', 'bathroom routine', 'outdoor relaxation', 'cozy corners'],
    clothing: ['comfortable home wear', 'yoga outfit', 'bath robe', 'casual chic', 'loungewear'],
    lighting: 'Natural daylight, golden hour, cozy ambient lighting',
    angles: 'Lifestyle documentation, natural poses, everyday moments',
    mood: 'relatable and authentic'
  },
  'casual': {
    themes: ['cozy morning', 'lazy afternoon', 'girl next door', 'everyday cute', 'spontaneous moment'],
    settings: ['bedroom', 'living room', 'kitchen', 'balcony', 'natural environment'],
    clothing: ['oversized sweater', 'cute pajamas', 'casual dress', 'jeans and top', 'comfortable loungewear'],
    lighting: 'Soft natural lighting from windows, golden hour warmth',
    angles: 'Natural candid angles, slightly above eye level, intimate close-ups',
    mood: 'relaxed and approachable'
  },
  'workout': {
    themes: ['fitness motivation', 'post-workout glow', 'gym session', 'yoga flow', 'athletic achievement'],
    settings: ['home gym', 'fitness studio', 'yoga mat area', 'outdoor park', 'mirror workout space'],
    clothing: ['sports bra', 'leggings', 'workout tank', 'yoga pants', 'athletic shorts'],
    lighting: 'Bright energetic lighting, gym lighting, natural outdoor light',
    angles: 'Dynamic action shots, mirror reflections, progress poses',
    mood: 'energetic and powerful'
  },
  'shower': {
    themes: ['morning routine', 'steamy bathroom', 'relaxation time', 'self-care moment', 'water therapy'],
    settings: ['bathroom', 'shower stall', 'bathtub area', 'steamy mirror', 'towel-wrapped moments'],
    clothing: ['towel wrapped', 'implied nudity', 'shower silhouette', 'steam-obscured'],
    lighting: 'Soft bathroom lighting, steam effects, warm glowing ambiance',
    angles: 'Artistic silhouettes, steam-obscured shots, water droplet details',
    mood: 'intimate and refreshing'
  },
  'showing-skin': {
    themes: ['artistic expression', 'body positivity', 'confident reveal', 'tasteful exposure', 'sensual elegance'],
    settings: ['bedroom', 'artistic studio', 'soft lighting area', 'natural backdrop', 'elegant interior'],
    clothing: ['lingerie', 'partial clothing', 'artistic draping', 'strategic covering', 'elegant undress'],
    lighting: 'Artistic dramatic lighting, soft shadows, flattering angles',
    angles: 'Tasteful artistic angles, flattering body shots, elegant poses',
    mood: 'confident and artistic'
  },
  'spicy': {
    themes: ['seductive allure', 'bedroom eyes', 'tantalizing tease', 'passionate expression', 'sultry mood'],
    settings: ['bedroom', 'intimate lighting', 'silk sheets', 'candle-lit room', 'luxury setting'],
    clothing: ['lingerie', 'silk robes', 'minimal coverage', 'seductive styling', 'elegant undress'],
    lighting: 'Dramatic intimate lighting, candle effects, mood lighting',
    angles: 'Seductive poses, intimate close-ups, passionate expressions',
    mood: 'seductive and alluring'
  },
  'very-spicy': {
    themes: ['unbridled passion', 'raw sensuality', 'intense desire', 'explicit artistry', 'bold expression'],
    settings: ['private bedroom', 'intimate sanctuary', 'luxury suite', 'artistic boudoir', 'personal space'],
    clothing: ['minimal to none', 'artistic positioning', 'strategic shadows', 'creative covering'],
    lighting: 'Dramatic contrasts, artistic shadows, professional boudoir lighting',
    angles: 'Bold artistic angles, intimate perspectives, passionate compositions',
    mood: 'intensely passionate and bold'
  },
  'all-xs': {
    themes: ['ultimate expression', 'no limits', 'complete freedom', 'artistic boundaries pushed', 'full creative expression'],
    settings: ['private studio', 'exclusive location', 'artistic sanctuary', 'personal creative space'],
    clothing: ['artistic freedom', 'creative expression', 'unlimited styling', 'boundary-free'],
    lighting: 'Professional studio lighting, artistic drama, creative illumination',
    angles: 'Unlimited creative angles, artistic freedom, boundary-pushing compositions',
    mood: 'completely uninhibited and free'
  }
};

// Text Tone Variations
const textToneStyles = {
  'confident': {
    starters: ["I know exactly", "Here's what", "Ready for", "You wanted", "Time for"],
    descriptors: ["bold", "powerful", "stunning", "magnificent", "incredible"],
    endings: ["and I deliver every time", "because quality matters", "no compromises here", "excellence is standard"],
    emojis: ["💪", "🔥", "⚡", "💎", "👑"]
  },
  'playful': {
    starters: ["Guess what", "Oops!", "Surprise!", "Hey there", "So..."],
    descriptors: ["cute", "silly", "adorable", "cheeky", "mischievous"],
    endings: ["hope you like it!", "whoops! 🙈", "couldn't resist!", "being a little naughty"],
    emojis: ["😘", "🙈", "😇", "💕", "🎀"]
  },
  'mysterious': {
    starters: ["Something happened", "In the shadows", "Late night", "Behind closed doors", "Secret moment"],
    descriptors: ["hidden", "forbidden", "mysterious", "secretive", "enigmatic"],
    endings: ["but that's all I'll say", "the rest remains hidden", "some secrets are worth keeping", "only for those who understand"],
    emojis: ["🌙", "🖤", "🕯️", "🔮", "💫"]
  },
  'authentic': {
    starters: ["Real talk", "Being honest", "Just me", "Genuine moment", "Truth is"],
    descriptors: ["real", "honest", "genuine", "authentic", "true"],
    endings: ["just being myself", "no filters needed", "this is who I am", "raw and real"],
    emojis: ["💯", "✨", "🌸", "💗", "🌟"]
  },
  'sassy': {
    starters: ["Listen up", "Well well", "Oh please", "You think", "Honey"],
    descriptors: ["fierce", "bold", "attitude", "confidence", "sass"],
    endings: ["deal with it", "take it or leave it", "that's how I roll", "bow down"],
    emojis: ["💅", "😏", "🔥", "👑", "💄"]
  }
};

// Generate content based on all parameters
export function generateAdvancedContent(params: ContentParameters): GeneratedContent {
  // Check if this is a preset request and use preset variations
  const presetVariation = getRandomPresetVariation(params.style);
  if (presetVariation) {
    console.log(`🎯 Using preset variation for: ${params.style}`);
    return {
      titles: presetVariation.titles,
      content: presetVariation.content,
      photoInstructions: {
        lighting: presetVariation.photoInstructions.lighting,
        angles: presetVariation.photoInstructions.cameraAngle,
        composition: presetVariation.photoInstructions.composition,
        styling: presetVariation.photoInstructions.styling,
        technical: presetVariation.photoInstructions.technicalSettings,
        sceneSetup: presetVariation.photoInstructions.mood
      },
      tags: ['preset-content', params.style, params.platform]
    };
  }

  // Fallback to existing system for non-preset requests
  const photoConfig = photoTypeVariations[params.photoType] || photoTypeVariations['casual'];
  const toneStyle = textToneStyles[params.textTone] || textToneStyles['authentic'];
  
  // Generate titles with variation
  const titles = generateTitles(params, photoConfig, toneStyle);
  
  // Generate main content
  const content = generateMainContent(params, photoConfig, toneStyle);
  
  // Generate photo instructions
  const photoInstructions = generatePhotoInstructions(params, photoConfig);
  
  // Generate tags
  const tags = generateTags(params, photoConfig);
  
  return {
    titles,
    content,
    photoInstructions,
    tags
  };
}

// Helper function to get random preset variation
function getRandomPresetVariation(presetId: string): any {
  const presetVariations: Record<string, any[]> = {
    'nude-photos': [
      {
        titles: ["Embracing my natural beauty today 💋", "Confidence level: absolutely stunning ✨", "Art meets body, beauty meets soul 🌸"],
        content: "There's something incredibly empowering about celebrating your natural form. Today I'm embracing every curve, every line, and feeling absolutely radiant. Art has always been about truth, and this is mine.",
        photoInstructions: {
          lighting: "Soft, flattering natural light or warm studio lighting",
          cameraAngle: "Artistic angles that celebrate the human form",
          composition: "Classical art-inspired compositions with tasteful framing",
          styling: "Natural beauty with minimal styling - let authenticity shine",
          mood: "Confident, artistic, and genuinely empowered",
          technicalSettings: "Shallow depth of field with artistic bokeh"
        }
      },
      {
        titles: ["Golden hour goddess energy ☀️", "When light meets skin perfectly ✨", "Natural beauty in its purest form 🌅"],
        content: "The golden hour brings out something magical - that perfect interplay of light and shadow that makes everything feel ethereal. Capturing these moments of pure, unfiltered beauty.",
        photoInstructions: {
          lighting: "Golden hour or warm sunset lighting",
          cameraAngle: "Silhouette and rim lighting focused angles",
          composition: "Backlit compositions with dramatic lighting effects",
          styling: "Minimal styling to showcase natural beauty",
          mood: "Ethereal, goddess-like, and naturally radiant",
          technicalSettings: "Backlit settings with controlled exposure"
        }
      },
      {
        titles: ["Artistic expression knows no bounds 🎨", "When photography becomes pure art ✨", "Creative freedom and beautiful forms 💫"],
        content: "Art doesn't follow rules - it creates them. This is about pushing creative boundaries and celebrating the human form as the masterpiece it is. Every shot tells a story of confidence and artistic vision.",
        photoInstructions: {
          lighting: "Dramatic artistic lighting with creative shadows",
          cameraAngle: "Avant-garde and experimental perspectives",
          composition: "Rule-breaking artistic compositions",
          styling: "Artistic expression through minimal styling",
          mood: "Creatively bold and artistically free",
          technicalSettings: "Creative lighting and shadow play techniques"
        }
      },
      {
        titles: ["Vulnerability is strength ✨", "Raw beauty and honest moments 💕", "Authentic self-expression at its finest 🌸"],
        content: "There's incredible strength in vulnerability. These intimate moments capture something real and honest - no masks, no pretense, just authentic beauty and genuine confidence.",
        photoInstructions: {
          lighting: "Soft, intimate lighting that enhances vulnerability",
          cameraAngle: "Close, intimate angles that show genuine emotion",
          composition: "Honest, authentic compositions",
          styling: "Natural, unposed styling that feels genuine",
          mood: "Vulnerable, honest, and beautifully authentic",
          technicalSettings: "Soft focus with warm, intimate tones"
        }
      },
      {
        titles: ["Celebrating feminine power 👑", "Strong, beautiful, and unapologetic 💪", "Owning my space and loving it ✨"],
        content: "Femininity is power. These shots celebrate everything that makes us strong, beautiful, and uniquely ourselves. No apologies, no compromises - just pure feminine energy.",
        photoInstructions: {
          lighting: "Strong, empowering lighting that shows confidence",
          cameraAngle: "Powerful angles that emphasize strength",
          composition: "Bold compositions showing feminine power",
          styling: "Confident styling that showcases strength",
          mood: "Powerfully feminine and unapologetically bold",
          technicalSettings: "High contrast lighting for dramatic impact"
        }
      },
      {
        titles: ["Morning light and gentle moments ☀️", "Soft skin, softer light, purest beauty 💕", "When daybreak meets natural grace ✨"],
        content: "Morning light has this magical quality - it's gentle, honest, and incredibly flattering. These quiet dawn moments capture beauty in its most natural, unguarded state.",
        photoInstructions: {
          lighting: "Soft morning light through windows",
          cameraAngle: "Gentle, flattering morning angles",
          composition: "Peaceful, serene compositions",
          styling: "Natural morning beauty with minimal styling",
          mood: "Serene, peaceful, and naturally beautiful",
          technicalSettings: "Soft, natural light with warm tones"
        }
      },
      {
        titles: ["Shadow and light dance together 🌙", "Mysterious beauty in black and white ✨", "When darkness meets luminescence 🖤"],
        content: "There's something captivating about the interplay of shadow and light. These moody shots explore the mysterious side of beauty - what's hidden can be just as powerful as what's revealed.",
        photoInstructions: {
          lighting: "Dramatic low-key lighting with strategic shadows",
          cameraAngle: "Mysterious angles that play with light and shadow",
          composition: "Chiaroscuro-inspired compositions",
          styling: "Minimal styling that emphasizes light and shadow",
          mood: "Mysterious, dramatic, and captivatingly moody",
          technicalSettings: "Low-key lighting with high contrast"
        }
      },
      {
        titles: ["Timeless elegance never fades 💎", "Classic beauty meets modern confidence ✨", "Sophistication in its purest form 👑"],
        content: "Some things never go out of style. These shots capture timeless elegance - the kind of beauty that transcends trends and speaks to something deeper and more enduring.",
        photoInstructions: {
          lighting: "Classic, elegant lighting schemes",
          cameraAngle: "Timeless portrait angles with modern flair",
          composition: "Classical compositions with contemporary edge",
          styling: "Elegant, sophisticated minimal styling",
          mood: "Timelessly elegant and sophisticatedly beautiful",
          technicalSettings: "Classic portraiture with modern technique"
        }
      },
      {
        titles: ["Free spirit, wild heart 🦋", "Untamed beauty in natural settings ✨", "When wilderness meets feminine grace 🌿"],
        content: "Breaking free from conventions and embracing the wild side of beauty. These natural moments capture something untamed and authentic - beauty without boundaries.",
        photoInstructions: {
          lighting: "Natural outdoor lighting in wild settings",
          cameraAngle: "Free-flowing, natural angles",
          composition: "Organic, unposed compositions in nature",
          styling: "Natural, free-spirited minimal styling",
          mood: "Wild, free, and naturally uninhibited",
          technicalSettings: "Natural light with organic, flowing compositions"
        }
      },
      {
        titles: ["Confidence is my best accessory 💋", "Owning every moment with style ✨", "Self-love looks good on me 💕"],
        content: "The best outfit is confidence, and I wear it well. These shots are about celebrating self-love, body positivity, and the incredible power of knowing your worth.",
        photoInstructions: {
          lighting: "Confident, flattering lighting that enhances self-assurance",
          cameraAngle: "Strong, confident angles that show self-possession",
          composition: "Bold compositions that command attention",
          styling: "Confident minimal styling that lets personality shine",
          mood: "Confidently self-assured and positively radiant",
          technicalSettings: "Bold, clear lighting with strong presence"
        }
      }
    ],
    'shower-content': [
      {
        titles: ["Steam, skin, and pure relaxation 💦", "Washing away the day in style ✨", "Hot water and hotter vibes 🔥"],
        content: "There's something incredibly therapeutic about a steamy shower - the warmth, the steam, the moment of pure relaxation. These intimate bathroom moments capture that perfect blend of sensuality and serenity.",
        photoInstructions: {
          lighting: "Soft, steamy bathroom lighting with warm tones",
          cameraAngle: "Intimate angles through steam and water droplets",
          composition: "Steam-enhanced compositions with water elements",
          styling: "Natural wet-hair styling with minimal makeup",
          mood: "Sensual, relaxed, and intimately peaceful",
          technicalSettings: "Soft focus through steam with warm color temperature"
        }
      },
      {
        titles: ["Water droplets and morning rituals ☀️", "Fresh start, fresh skin, fresh energy 💧", "Morning shower = instant glow-up ✨"],
        content: "Morning showers hit different - they're about renewal, fresh starts, and that incredible feeling of being completely clean and ready for anything. Pure morning energy.",
        photoInstructions: {
          lighting: "Bright morning light in clean bathroom setting",
          cameraAngle: "Fresh, energizing angles showing morning routine",
          composition: "Clean, bright compositions with water elements",
          styling: "Fresh-faced morning styling",
          mood: "Energetic, fresh, and morning-bright",
          technicalSettings: "Clean, bright lighting with crisp details"
        }
      },
      {
        titles: ["Candlelit baths and wine nights 🕯️", "Self-care Sunday in full effect 🛁", "Bubbles, candles, and me time ✨"],
        content: "Self-care isn't selfish - it's essential. These luxurious bath moments are about taking time for yourself, creating that perfect atmosphere of relaxation and indulgence.",
        photoInstructions: {
          lighting: "Warm candlelight with soft ambient lighting",
          cameraAngle: "Luxurious angles showing self-care rituals",
          composition: "Spa-like compositions with candles and bubbles",
          styling: "Relaxed, pampered styling",
          mood: "Luxurious, self-caring, and indulgently peaceful",
          technicalSettings: "Warm, soft lighting with romantic ambiance"
        }
      },
      {
        titles: ["After-workout shower bliss 💪", "Sweaty to sparkling in 10 minutes ✨", "Post-gym glow-up in progress 🚿"],
        content: "That post-workout shower is pure heaven - washing away the sweat and feeling that incredible post-exercise endorphin rush. Clean skin, clear mind, unstoppable energy.",
        photoInstructions: {
          lighting: "Clean, energizing lighting showing post-workout freshness",
          cameraAngle: "Athletic angles showing fitness and cleanliness",
          composition: "Energetic compositions with water and movement",
          styling: "Athletic, post-workout natural styling",
          mood: "Energetic, accomplished, and athletically fresh",
          technicalSettings: "Dynamic lighting capturing energy and movement"
        }
      },
      {
        titles: ["Glass doors and artistic reflections 🪞", "When shower becomes art installation ✨", "Reflections of beauty through steam 💧"],
        content: "Sometimes the most artistic shots happen in unexpected places. These glass shower moments play with reflections, steam, and transparency to create something truly artistic.",
        photoInstructions: {
          lighting: "Artistic lighting playing with glass and reflections",
          cameraAngle: "Creative angles using glass doors and mirrors",
          composition: "Artistic compositions with reflections and transparency",
          styling: "Artistically minimal styling",
          mood: "Artistically creative and visually stunning",
          technicalSettings: "Creative lighting with reflection and transparency effects"
        }
      },
      {
        titles: ["Rainfall shower = pure heaven ☔", "When water pressure meets pure bliss 💆", "Natural waterfall vibes at home ✨"],
        content: "There's nothing quite like a powerful rainfall shower - it's like standing under a gentle waterfall, letting all the stress wash away. Pure hydrotherapy at its finest.",
        photoInstructions: {
          lighting: "Natural lighting simulating outdoor rainfall",
          cameraAngle: "Angles that show the cascade of water",
          composition: "Waterfall-inspired compositions",
          styling: "Natural, water-enhanced styling",
          mood: "Naturally refreshing and waterfall-peaceful",
          technicalSettings: "Lighting that enhances water cascade effects"
        }
      },
      {
        titles: ["Midnight shower confessions 🌙", "3am thoughts and hot water therapy 💭", "When darkness meets cleansing rituals ✨"],
        content: "Late-night showers hit different - they're contemplative, peaceful, and somehow more intimate. These quiet midnight moments are about solitude and self-reflection.",
        photoInstructions: {
          lighting: "Moody, low-key nighttime bathroom lighting",
          cameraAngle: "Contemplative angles in dim lighting",
          composition: "Moody, nighttime compositions",
          styling: "Natural, nighttime minimal styling",
          mood: "Contemplative, peaceful, and midnight-intimate",
          technicalSettings: "Low-key lighting with mysterious atmosphere"
        }
      },
      {
        titles: ["Luxury spa vibes at home 🧖‍♀️", "5-star treatment in my own bathroom ✨", "Hotel suite energy, home comfort 🏨"],
        content: "Creating that luxury spa experience at home - high-end bath products, perfect lighting, and that feeling of complete indulgence. Sometimes you just need to treat yourself like royalty.",
        photoInstructions: {
          lighting: "Luxury spa-style lighting",
          cameraAngle: "High-end, luxurious angles",
          composition: "Spa-like compositions with luxury elements",
          styling: "Luxurious, spa-quality styling",
          mood: "Luxuriously pampered and spa-serene",
          technicalSettings: "High-end lighting creating luxury atmosphere"
        }
      },
      {
        titles: ["Ocean vibes in my shower 🌊", "Salt scrubs and sea-inspired rituals ✨", "Bringing the beach to my bathroom 🏖️"],
        content: "Channeling those ocean vibes with sea salt scrubs and marine-inspired bath rituals. Sometimes you need to bring the beach to you - salt, steam, and sea goddess energy.",
        photoInstructions: {
          lighting: "Ocean-inspired lighting with blue and aqua tones",
          cameraAngle: "Flowing, wave-like angles",
          composition: "Ocean-inspired compositions with flowing water",
          styling: "Beach-goddess natural styling",
          mood: "Ocean-peaceful and sea-goddess divine",
          technicalSettings: "Blue-toned lighting with flowing water effects"
        }
      },
      {
        titles: ["Quick rinse, major glow-up ✨", "5-minute shower, 100% refreshed 💦", "Efficiency meets luxury perfectly 🚿"],
        content: "Sometimes you only have 5 minutes, but that doesn't mean you can't make it count. These quick shower moments are about maximum refreshment in minimum time - efficient luxury.",
        photoInstructions: {
          lighting: "Quick, efficient yet flattering lighting",
          cameraAngle: "Dynamic angles showing speed and efficiency",
          composition: "Fast-paced yet beautiful compositions",
          styling: "Quick, efficient natural styling",
          mood: "Efficiently refreshed and quickly beautiful",
          technicalSettings: "Dynamic lighting capturing swift beauty"
        }
      }
    ],
    'workout-clothes': [
      {
        titles: ["Post-gym glow hitting different 💪", "Sweat equity paying dividends ✨", "When endorphins meet confidence 🔥"],
        content: "That post-workout feeling is unmatched - endorphins flowing, muscles pumped, and that incredible sense of accomplishment. This is what strength looks like, and it's beautiful.",
        photoInstructions: {
          lighting: "Energetic gym lighting or natural post-workout glow",
          cameraAngle: "Strong, athletic angles showing fitness",
          composition: "Dynamic compositions showcasing strength",
          styling: "Athletic wear that shows off hard work",
          mood: "Strong, accomplished, and athletically confident",
          technicalSettings: "High-energy lighting capturing athletic power"
        }
      },
      {
        titles: ["Gym fit = confidence fit 💯", "When your workout clothes work overtime ✨", "Athletic wear, athletic attitude 👟"],
        content: "The right workout gear doesn't just perform - it makes you feel unstoppable. These athletic moments capture that perfect blend of function and fierce confidence.",
        photoInstructions: {
          lighting: "Clean, athletic lighting showing gear details",
          cameraAngle: "Fashion-forward athletic angles",
          composition: "Sportswear-focused compositions",
          styling: "Athletic fashion styling",
          mood: "Fashionably athletic and confidently sporty",
          technicalSettings: "Clean lighting highlighting athletic wear"
        }
      },
      {
        titles: ["Yoga flow and inner peace 🧘‍♀️", "Flexibility of body, strength of spirit ✨", "Zen mode: activated 🌸"],
        content: "Yoga isn't just exercise - it's meditation in motion. These peaceful moments capture the grace, flexibility, and inner strength that comes from mindful movement.",
        photoInstructions: {
          lighting: "Soft, peaceful lighting for yoga ambiance",
          cameraAngle: "Graceful angles showing yoga poses",
          composition: "Zen-like compositions with balance",
          styling: "Comfortable yoga wear",
          mood: "Peacefully centered and gracefully strong",
          technicalSettings: "Soft, calming lighting for peaceful atmosphere"
        }
      },
      {
        titles: ["Running wild and free 🏃‍♀️", "Miles logged, spirit soaring ✨", "Pavement princess energy 👑"],
        content: "There's nothing like that runner's high - the rhythm, the freedom, the feeling that you could conquer the world one mile at a time. This is pure athletic poetry.",
        photoInstructions: {
          lighting: "Dynamic outdoor lighting capturing movement",
          cameraAngle: "Action angles showing running motion",
          composition: "Movement-focused compositions",
          styling: "Performance running gear",
          mood: "Energetically free and athletically unstoppable",
          technicalSettings: "Motion-capturing lighting with dynamic effects"
        }
      },
      {
        titles: ["Weight room warrior mode 🏋️‍♀️", "Iron therapy in session ✨", "Building strength, one rep at a time 💪"],
        content: "The weight room is my therapy session - every lift builds not just muscle, but confidence. These powerful moments capture the raw strength and determination it takes to grow.",
        photoInstructions: {
          lighting: "Dramatic gym lighting with strong contrasts",
          cameraAngle: "Powerful angles emphasizing strength",
          composition: "Strength-focused compositions with equipment",
          styling: "Serious weightlifting gear",
          mood: "Powerfully determined and strength-focused",
          technicalSettings: "Dramatic lighting highlighting muscle definition"
        }
      },
      {
        titles: ["Pre-workout ritual complete ⚡", "Game face on, let's do this 🔥", "Energy levels: maximum overdrive ✨"],
        content: "That pre-workout energy is electric - the anticipation, the focus, the feeling that you're about to conquer your goals. This is the moment before magic happens.",
        photoInstructions: {
          lighting: "High-energy lighting building anticipation",
          cameraAngle: "Focused, determined angles",
          composition: "Pre-action compositions showing readiness",
          styling: "Fresh, ready-to-work athletic wear",
          mood: "Energetically focused and ready for action",
          technicalSettings: "Bright, energizing lighting for motivation"
        }
      },
      {
        titles: ["Home gym, hotel vibes 🏠", "No excuses, just results ✨", "Convenience meets commitment 💯"],
        content: "You don't need a fancy gym to get results - just dedication and creativity. These home workout moments prove that fitness is about mindset, not location.",
        photoInstructions: {
          lighting: "Clean home lighting optimized for workouts",
          cameraAngle: "Creative home gym angles",
          composition: "Home fitness compositions",
          styling: "Comfortable home workout attire",
          mood: "Creatively committed and home-fitness focused",
          technicalSettings: "Adaptable lighting for home workout spaces"
        }
      },
      {
        titles: ["Team spirit, personal goals 👯‍♀️", "Better together, stronger apart ✨", "Squad fitness energy 🤝"],
        content: "Working out with friends brings a different energy - accountability, motivation, and those moments when you push each other to be better. Fitness is more fun with friends.",
        photoInstructions: {
          lighting: "Group-friendly lighting for multiple people",
          cameraAngle: "Group fitness angles showing teamwork",
          composition: "Team-focused compositions",
          styling: "Coordinated group athletic wear",
          mood: "Collaboratively energetic and team-spirited",
          technicalSettings: "Group lighting optimized for multiple subjects"
        }
      },
      {
        titles: ["Outdoor training, natural gym 🌳", "Fresh air fuel for fitness ✨", "Nature's playground activated 🏞️"],
        content: "Sometimes the best gym is the great outdoors - fresh air, natural terrain, and that connection with nature that makes every workout feel like an adventure.",
        photoInstructions: {
          lighting: "Natural outdoor lighting",
          cameraAngle: "Outdoor fitness angles with nature backdrop",
          composition: "Nature-integrated fitness compositions",
          styling: "Outdoor-appropriate athletic wear",
          mood: "Naturally energetic and outdoors-adventurous",
          technicalSettings: "Natural lighting with outdoor elements"
        }
      },
      {
        titles: ["Recovery day = self-care day 🛁", "Rest is part of the process ✨", "Muscles healing, spirit growing 💆‍♀️"],
        content: "Recovery isn't weakness - it's wisdom. These gentle moments capture the importance of rest, stretching, and giving your body the care it needs to come back stronger.",
        photoInstructions: {
          lighting: "Soft, recovery-focused lighting",
          cameraAngle: "Gentle, self-care angles",
          composition: "Recovery and stretching compositions",
          styling: "Comfortable recovery wear",
          mood: "Peacefully recovering and self-caring",
          technicalSettings: "Soft, healing lighting for recovery atmosphere"
        }
      }
    ],
    'lingerie': [
      {
        titles: ["Elegance in silk and lace 💎", "When luxury meets femininity ✨", "Sophisticated allure at its finest 👑"],
        content: "There's an art to lingerie - the delicate fabrics, the careful construction, the way it makes you feel powerful and feminine at once. This is elegance embodied.",
        photoInstructions: {
          lighting: "Soft, luxurious lighting that enhances fabric textures",
          cameraAngle: "Elegant angles that show sophistication",
          composition: "Refined compositions focusing on luxury details",
          styling: "High-end lingerie with tasteful accessories",
          mood: "Sophisticatedly elegant and luxuriously feminine",
          technicalSettings: "Soft lighting that highlights fabric details and textures"
        }
      },
      {
        titles: ["Boudoir vibes and bedroom eyes 😍", "Intimate moments, infinite beauty ✨", "Bedroom confessions in silk 💋"],
        content: "The bedroom is a sanctuary, and these intimate moments capture that private elegance - soft fabrics, gentle lighting, and the kind of beauty that's meant for special eyes only.",
        photoInstructions: {
          lighting: "Intimate boudoir lighting with warm tones",
          cameraAngle: "Close, intimate angles for boudoir effect",
          composition: "Intimate bedroom compositions",
          styling: "Romantic lingerie in bedroom setting",
          mood: "Intimately romantic and boudoir-elegant",
          technicalSettings: "Warm, intimate lighting for boudoir atmosphere"
        }
      },
      {
        titles: ["Lace details and delicate beauty 🌸", "Craftsmanship meets feminine grace ✨", "When artistry adorns the body 💕"],
        content: "Every piece of lace tells a story - the intricate patterns, the delicate craftsmanship, the way it frames and enhances natural beauty. This is wearable art.",
        photoInstructions: {
          lighting: "Detail-focused lighting showing lace patterns",
          cameraAngle: "Close-up angles highlighting lace details",
          composition: "Detail-focused compositions showing craftsmanship",
          styling: "Lace-focused lingerie styling",
          mood: "Delicately artistic and craft-appreciating",
          technicalSettings: "Macro-style lighting for intricate detail capture"
        }
      },
      {
        titles: ["Satin dreams and silk fantasies ✨", "Smooth textures, smoother confidence 💫", "Luxury fabric, luxurious feelings 🌙"],
        content: "Satin and silk have this magical quality - they feel incredible against the skin and somehow make everything more elegant. These luxurious moments celebrate texture and touch.",
        photoInstructions: {
          lighting: "Luxury lighting that enhances satin and silk",
          cameraAngle: "Texture-emphasizing angles",
          composition: "Fabric-focused luxury compositions",
          styling: "High-end satin and silk pieces",
          mood: "Luxuriously textured and silk-smooth confident",
          technicalSettings: "Lighting that captures fabric luster and smoothness"
        }
      },
      {
        titles: ["Vintage romance meets modern confidence 🌹", "Timeless pieces, contemporary attitude ✨", "Classic beauty with bold spirit 💄"],
        content: "Vintage-inspired lingerie has this incredible romance to it - classic cuts, timeless elegance, but worn with modern confidence. Old-school glamour meets new-school attitude.",
        photoInstructions: {
          lighting: "Vintage-inspired lighting with modern clarity",
          cameraAngle: "Classic vintage angles with contemporary flair",
          composition: "Retro-inspired compositions",
          styling: "Vintage-style lingerie with modern confidence",
          mood: "Vintage-romantic yet modern-confident",
          technicalSettings: "Classic lighting with contemporary technique"
        }
      },
      {
        titles: ["Black lace and bold statements 🖤", "Dark elegance, bright confidence ✨", "When mystery meets unmistakable allure 🌙"],
        content: "Black lace is classic for a reason - it's mysterious, elegant, and undeniably powerful. These dark elegance moments capture that timeless appeal of sophisticated allure.",
        photoInstructions: {
          lighting: "Dramatic lighting that complements black lace",
          cameraAngle: "Bold angles that show dramatic elegance",
          composition: "High-contrast compositions with black lace",
          styling: "Statement black lace pieces",
          mood: "Dramatically elegant and mysteriously confident",
          technicalSettings: "High-contrast lighting for dramatic black lace"
        }
      },
      {
        titles: ["Pastel pretty and soft femininity 🌸", "Sweet colors, strong confidence ✨", "Gentle hues, powerful presence 💕"],
        content: "Soft pastels have their own power - they're gentle but confident, sweet but strong. These delicate moments prove that femininity comes in many beautiful forms.",
        photoInstructions: {
          lighting: "Soft, pastel-enhancing lighting",
          cameraAngle: "Gentle angles that complement soft colors",
          composition: "Soft, feminine compositions",
          styling: "Pastel lingerie with delicate accessories",
          mood: "Softly feminine yet confidently strong",
          technicalSettings: "Soft lighting that enhances pastel colors"
        }
      },
      {
        titles: ["Mix and match, style and sass 💫", "Personal style has no rules ✨", "Creating looks that feel uniquely me 🎨"],
        content: "The best lingerie style is your own style - mixing pieces, creating unique combinations, and wearing what makes you feel incredible. Personal expression through beautiful pieces.",
        photoInstructions: {
          lighting: "Creative lighting for unique styling",
          cameraAngle: "Style-focused angles showing creativity",
          composition: "Creative styling compositions",
          styling: "Mixed and matched pieces showing personal style",
          mood: "Creatively confident and personally stylish",
          technicalSettings: "Versatile lighting for creative styling"
        }
      },
      {
        titles: ["Special occasion, special pieces ✨", "When the moment calls for luxury 💎", "Celebration-worthy elegance 🥂"],
        content: "Some moments deserve the special pieces - anniversaries, celebrations, or just because you want to feel extraordinary. These are the pieces that make ordinary moments magical.",
        photoInstructions: {
          lighting: "Celebratory lighting for special occasions",
          cameraAngle: "Special occasion angles showing luxury",
          composition: "Celebration-worthy compositions",
          styling: "Special occasion luxury lingerie",
          mood: "Celebratorily elegant and special-occasion confident",
          technicalSettings: "Luxury lighting for special occasion feel"
        }
      },
      {
        titles: ["Comfort meets beauty perfectly 💕", "All-day elegance that feels amazing ✨", "Beautiful AND comfortable - possible! 🌟"],
        content: "The best lingerie doesn't make you choose between comfort and beauty - it gives you both. These everyday luxury pieces prove you can feel amazing and look incredible.",
        photoInstructions: {
          lighting: "Comfortable, everyday lighting",
          cameraAngle: "Comfortable, natural angles",
          composition: "Everyday comfort compositions",
          styling: "Comfortable yet beautiful lingerie",
          mood: "Comfortably confident and beautifully relaxed",
          technicalSettings: "Natural lighting for comfortable elegance"
        }
      }
    ],
    'casual-tease': [
      {
        titles: ["Oops, did I leave this unbuttoned? 😇", "Accident or strategy? You decide 😉", "Sometimes subtle is sexiest ✨"],
        content: "The best teasing is accidental-on-purpose - that perfectly imperfect moment when something slips, gaps, or reveals just enough to make you wonder. Casual never felt so intentional.",
        photoInstructions: {
          lighting: "Natural, casual lighting with soft shadows",
          cameraAngle: "Candid angles that feel unposed",
          composition: "Casual compositions with subtle reveals",
          styling: "Everyday clothes with strategic styling",
          mood: "Casually flirty and subtly teasing",
          technicalSettings: "Natural lighting for authentic casual feel"
        }
      },
      {
        titles: ["Morning coffee, evening thoughts ☕", "Oversized shirt, undersized inhibitions ✨", "Lazy morning, deliberate choices 😏"],
        content: "Morning routines have never looked so good - oversized shirts, messy hair, and that perfect combination of comfortable and captivating. Some accidents are happy ones.",
        photoInstructions: {
          lighting: "Soft morning light through windows",
          cameraAngle: "Intimate morning angles",
          composition: "Cozy morning compositions",
          styling: "Oversized shirts and morning casual wear",
          mood: "Morning-intimate and casually comfortable",
          technicalSettings: "Warm morning lighting for cozy atmosphere"
        }
      },
      {
        titles: ["Study break, distraction included 📚", "When homework gets interesting ✨", "Academic focus, wandering mind 😉"],
        content: "Study sessions just got a lot more interesting. Sometimes the best way to take a break from the books is to create a different kind of education entirely.",
        photoInstructions: {
          lighting: "Study lighting with intimate shadows",
          cameraAngle: "Study space angles with casual reveals",
          composition: "Academic setting with playful elements",
          styling: "Casual study wear with subtle styling",
          mood: "Studious yet playfully distracted",
          technicalSettings: "Desk lighting with warm intimate tones"
        }
      },
      {
        titles: ["Girl next door with a secret 🏠", "Wholesome vibes, hidden depths ✨", "Sweet smile, naughty thoughts 😇"],
        content: "The girl next door always has the most interesting secrets. These wholesome moments hide something deeper - that perfect combination of sweet and slightly wicked.",
        photoInstructions: {
          lighting: "Wholesome yet intriguing lighting",
          cameraAngle: "Girl-next-door angles with hidden depth",
          composition: "Innocent compositions with subtle intrigue",
          styling: "Sweet, everyday styling with hints of mischief",
          mood: "Wholesomely sweet with hidden mischief",
          technicalSettings: "Clean lighting with mysterious undertones"
        }
      },
      {
        titles: ["Cooking class just got spicy 🔥", "Kitchen heat, different kind of fire ✨", "Recipe for distraction included 👨‍🍳"],
        content: "Cooking just became a lot more interesting. When the kitchen heats up in more ways than one, everyday activities take on a whole new flavor.",
        photoInstructions: {
          lighting: "Warm kitchen lighting",
          cameraAngle: "Kitchen activity angles with playful reveals",
          composition: "Cooking compositions with casual teasing",
          styling: "Kitchen casual wear with strategic styling",
          mood: "Domestically playful and kitchen-confident",
          technicalSettings: "Warm, homey lighting for kitchen setting"
        }
      },
      {
        titles: ["Netflix and... well, you know 📺", "Couch potato with benefits ✨", "Binge watching, strategic positioning 😉"],
        content: "Movie nights just got an upgrade. Sometimes the best entertainment isn't on the screen - it's in how you arrange yourself to watch it.",
        photoInstructions: {
          lighting: "Cozy TV lighting with intimate ambiance",
          cameraAngle: "Relaxed couch angles with casual positioning",
          composition: "Living room compositions with comfortable reveals",
          styling: "Comfy couch wear with strategic arrangement",
          mood: "Cozily intimate and casually arranged",
          technicalSettings: "Ambient lighting for cozy evening atmosphere"
        }
      },
      {
        titles: ["Workout gear, working it out 💪", "Gym clothes, bedroom energy ✨", "Athletic wear, athletic attractions 🏃‍♀️"],
        content: "Athletic wear has this amazing quality - it's practical but somehow incredibly attractive. These workout moments prove that fitness fashion can be functionally flirty.",
        photoInstructions: {
          lighting: "Athletic lighting with casual intimacy",
          cameraAngle: "Fitness angles with casual appeal",
          composition: "Athletic compositions with casual allure",
          styling: "Workout gear with casually attractive styling",
          mood: "Athletically casual and fitness-flirty",
          technicalSettings: "Energetic lighting with casual warmth"
        }
      },
      {
        titles: ["Getting ready, getting ideas 💭", "Mirror check, double take ✨", "Dressing room discoveries 👗"],
        content: "Getting ready is an art form - especially when you catch yourself in the mirror and realize how good this outfit makes you feel. Some discoveries are worth sharing.",
        photoInstructions: {
          lighting: "Dressing room lighting with mirror reflections",
          cameraAngle: "Getting-ready angles with mirror work",
          composition: "Dressing compositions with reflection elements",
          styling: "Mid-dressing casual styling",
          mood: "Preparation-confident and mirror-pleased",
          technicalSettings: "Mirror lighting for dressing room atmosphere"
        }
      },
      {
        titles: ["Work from home, working it out 💻", "Professional top, casual bottom ✨", "Video call ready, everything else optional 😉"],
        content: "Work from home has its perks - professional on top, comfortable everywhere else. These behind-the-scenes moments show what really happens off-camera.",
        photoInstructions: {
          lighting: "Home office lighting with casual intimacy",
          cameraAngle: "Work-from-home angles showing contrasts",
          composition: "Home office compositions with casual reveals",
          styling: "Professional/casual hybrid styling",
          mood: "Professionally casual and work-from-home relaxed",
          technicalSettings: "Office lighting with comfortable home atmosphere"
        }
      },
      {
        titles: ["Sleepy vibes, wide awake thoughts 😴", "Pajama party for one ✨", "Bedtime stories, adult edition 📖"],
        content: "Bedtime routines have never been so interesting. Sometimes the best stories happen when you're supposed to be sleeping, and pajamas have never looked so good.",
        photoInstructions: {
          lighting: "Soft bedtime lighting with intimate warmth",
          cameraAngle: "Bedtime angles with comfortable positioning",
          composition: "Bedroom compositions with sleepy comfort",
          styling: "Pajama styling with comfortable appeal",
          mood: "Sleepily comfortable and bedtime-intimate",
          technicalSettings: "Soft evening lighting for bedtime atmosphere"
        }
      }
    ],
    'bedroom-scene': [
      {
        titles: ["Sheets, skin, and Sunday mornings ☀️", "Lazy bed days, purposeful moments ✨", "When comfort meets confidence 🛏️"],
        content: "Sunday mornings in bed are sacred - soft sheets, gentle light, and that perfect feeling of having nowhere else to be. These intimate bedroom moments capture pure comfort and quiet confidence.",
        photoInstructions: {
          lighting: "Soft morning light filtering through bedroom windows",
          cameraAngle: "Intimate bedroom angles with comfortable positioning",
          composition: "Bed-focused compositions with soft textures",
          styling: "Comfortable bedroom wear with natural styling",
          mood: "Intimately comfortable and bedroom-peaceful",
          technicalSettings: "Soft, natural lighting for intimate bedroom atmosphere"
        }
      },
      {
        titles: ["Silk pillowcases and satin dreams 💭", "Luxury textures, luxurious feelings ✨", "Bedroom upgrade, confidence upgrade 💫"],
        content: "Upgrading your bedroom is upgrading your whole mood - silk pillowcases, satin sheets, and that feeling of sleeping in luxury every night. These moments celebrate bedroom elegance.",
        photoInstructions: {
          lighting: "Luxurious bedroom lighting emphasizing textures",
          cameraAngle: "Luxury angles showing high-end bedroom details",
          composition: "Elegant bedroom compositions with luxury elements",
          styling: "Luxury sleepwear with elegant bedroom styling",
          mood: "Luxuriously comfortable and elegantly intimate",
          technicalSettings: "Rich lighting that highlights luxury textures"
        }
      },
      {
        titles: ["Reading nook, writing fantasies 📚", "Books, bed, and beautiful thoughts ✨", "Literary lounging at its finest 💭"],
        content: "The bedroom isn't just for sleeping - it's for reading, dreaming, and letting your imagination wander. These cozy literary moments capture the intellectual side of intimate spaces.",
        photoInstructions: {
          lighting: "Cozy reading light in bedroom setting",
          cameraAngle: "Literary angles with books and comfortable positioning",
          composition: "Reading-focused bedroom compositions",
          styling: "Comfortable reading attire in bedroom setting",
          mood: "Intellectually intimate and literarily cozy",
          technicalSettings: "Warm reading light for cozy literary atmosphere"
        }
      },
      {
        titles: ["Candlelit confessions and whispered secrets 🕯️", "Romantic lighting, intimate moments ✨", "When atmosphere meets authenticity 🌙"],
        content: "Candlelight transforms everything - suddenly the bedroom becomes a sanctuary of romance and intimacy. These atmospheric moments capture the magic of soft lighting and quiet confidences.",
        photoInstructions: {
          lighting: "Warm candlelight creating romantic bedroom ambiance",
          cameraAngle: "Romantic angles enhanced by candlelight",
          composition: "Candle-lit bedroom compositions with intimate atmosphere",
          styling: "Romantic bedroom wear in candlelit setting",
          mood: "Romantically intimate and candle-warm",
          technicalSettings: "Candlelight photography with warm romantic tones"
        }
      },
      {
        titles: ["Mirror, mirror, bedroom wall 🪞", "Reflections of beauty and confidence ✨", "When vanity meets vulnerability 💕"],
        content: "Bedroom mirrors catch the most honest moments - getting ready, unwinding, and those private seconds when you see yourself truly. These reflection moments capture authentic beauty.",
        photoInstructions: {
          lighting: "Vanity lighting with bedroom mirror reflections",
          cameraAngle: "Mirror angles showing bedroom reflections",
          composition: "Mirror-focused bedroom compositions",
          styling: "Vanity styling in bedroom mirror setting",
          mood: "Reflectively confident and mirror-honest",
          technicalSettings: "Mirror lighting for clear reflections and intimate atmosphere"
        }
      },
      {
        titles: ["Fresh sheets, fresh start 🌟", "Clean bed, clear mind ✨", "New linens, new possibilities 💫"],
        content: "There's something magical about fresh sheets - they smell like possibility and feel like a fresh start. These clean bedroom moments celebrate the simple luxury of pristine linens.",
        photoInstructions: {
          lighting: "Clean, fresh lighting for crisp bedroom feel",
          cameraAngle: "Fresh angles emphasizing clean lines",
          composition: "Clean bedroom compositions with fresh elements",
          styling: "Fresh, clean bedroom styling",
          mood: "Freshly clean and crisply comfortable",
          technicalSettings: "Bright, clean lighting for fresh bedroom atmosphere"
        }
      },
      {
        titles: ["Pillow fort architect at work 🏰", "Adult blanket forts and childhood dreams ✨", "Cozy construction projects 🛠️"],
        content: "Who says pillow forts are just for kids? These cozy construction moments prove that sometimes the best architecture is soft, comfortable, and built for maximum cuddle potential.",
        photoInstructions: {
          lighting: "Playful lighting for cozy fort atmosphere",
          cameraAngle: "Cozy angles within pillow fort structures",
          composition: "Fort-building compositions with soft textures",
          styling: "Comfortable fort-building attire",
          mood: "Playfully cozy and architecturally comfortable",
          technicalSettings: "Soft, enclosed lighting for cozy fort feeling"
        }
      },
      {
        titles: ["Window seat wisdom 🪟", "Natural light, natural beauty ✨", "Bedroom views and inner reflections 🌅"],
        content: "The bedroom window seat is where the best thinking happens - natural light, comfortable cushions, and that perfect view of the world outside. These contemplative moments capture quiet wisdom.",
        photoInstructions: {
          lighting: "Natural window light in bedroom setting",
          cameraAngle: "Window seat angles with natural light",
          composition: "Window-focused bedroom compositions",
          styling: "Natural window light styling",
          mood: "Contemplatively peaceful and naturally lit",
          technicalSettings: "Natural window lighting for contemplative atmosphere"
        }
      },
      {
        titles: ["Breakfast in bed, luxury served 🥐", "Room service to the heart ✨", "When the bedroom becomes a restaurant 🍳"],
        content: "Breakfast in bed isn't just about food - it's about luxury, indulgence, and treating yourself like royalty. These decadent morning moments celebrate bedroom dining at its finest.",
        photoInstructions: {
          lighting: "Morning dining light in bedroom setting",
          cameraAngle: "Breakfast-in-bed angles with food styling",
          composition: "Dining compositions in bedroom setting",
          styling: "Breakfast dining attire in bedroom",
          mood: "Luxuriously indulgent and breakfast-happy",
          technicalSettings: "Appetizing lighting for bedroom dining atmosphere"
        }
      },
      {
        titles: ["Midnight journaling sessions 🌙", "Late night thoughts, early morning clarity ✨", "When darkness inspires light 💭"],
        content: "The best thoughts often come at midnight - when the world is quiet and your mind is free to wander. These late-night bedroom moments capture the magic of midnight inspiration.",
        photoInstructions: {
          lighting: "Soft midnight lighting for journaling",
          cameraAngle: "Late-night contemplative angles",
          composition: "Midnight bedroom compositions with writing elements",
          styling: "Comfortable late-night attire",
          mood: "Midnight-contemplative and journaling-focused",
          technicalSettings: "Gentle nighttime lighting for late-night atmosphere"
        }
      }
    ],
    'outdoor-adventure': [
      {
        titles: ["Mother Nature and natural beauty 🌿", "Wild spaces, wild spirit ✨", "Adventure calls, confidence answers 🏔️"],
        content: "There's something magical about connecting with nature - the fresh air, the open spaces, and that feeling of freedom that only comes from wild places. These adventure moments capture pure natural beauty.",
        photoInstructions: {
          lighting: "Natural outdoor lighting with landscape elements",
          cameraAngle: "Adventure angles with natural backdrop",
          composition: "Nature-integrated compositions with outdoor elements",
          styling: "Adventure-appropriate styling with natural elements",
          mood: "Adventurously free and naturally confident",
          technicalSettings: "Outdoor lighting optimized for natural settings"
        }
      },
      {
        titles: ["Beach vibes and ocean energy 🌊", "Salt air, sun-kissed skin ✨", "Mermaid mode activated 🧜‍♀️"],
        content: "The beach brings out something primal and free - the endless horizon, the rhythmic waves, and that sun-kissed glow that makes everything feel magical. These oceanic moments capture coastal confidence.",
        photoInstructions: {
          lighting: "Golden beach lighting with ocean backdrop",
          cameraAngle: "Coastal angles with water elements",
          composition: "Beach compositions with ocean integration",
          styling: "Beach-appropriate styling with coastal elements",
          mood: "Ocean-free and beach-confident",
          technicalSettings: "Beach lighting with water and sand reflections"
        }
      },
      {
        titles: ["Mountain high, spirit higher 🏔️", "Peak experiences, peak confidence ✨", "Summit views, summit feelings ⛰️"],
        content: "Mountains have a way of putting everything in perspective - the climb, the view, and that incredible feeling of accomplishment when you reach the top. These elevated moments capture mountain magic.",
        photoInstructions: {
          lighting: "Mountain lighting with elevation effects",
          cameraAngle: "Summit angles with mountain backdrop",
          composition: "Mountain compositions with peak elements",
          styling: "Mountain adventure styling",
          mood: "Peak-accomplished and mountain-strong",
          technicalSettings: "High-altitude lighting with mountain atmosphere"
        }
      },
      {
        titles: ["Forest bathing and tree therapy 🌲", "Woodland wandering and natural healing ✨", "Tree hugger and proud of it 🌳"],
        content: "Forest bathing is real therapy - the green canopy, the filtered light, and that ancient energy that comes from being among old trees. These woodland moments capture forest peace.",
        photoInstructions: {
          lighting: "Filtered forest lighting through tree canopy",
          cameraAngle: "Forest angles with tree integration",
          composition: "Woodland compositions with tree elements",
          styling: "Forest-appropriate natural styling",
          mood: "Forest-peaceful and tree-connected",
          technicalSettings: "Dappled forest lighting with natural green tones"
        }
      },
      {
        titles: ["Desert dreams and cactus courage 🌵", "Arid beauty, abundant spirit ✨", "Blooming where I'm planted 🌸"],
        content: "The desert teaches resilience - beauty in harsh conditions, strength in solitude, and the incredible power of blooming wherever you're planted. These desert moments capture arid elegance.",
        photoInstructions: {
          lighting: "Desert lighting with arid landscape elements",
          cameraAngle: "Desert angles with landscape integration",
          composition: "Arid compositions with desert elements",
          styling: "Desert-appropriate adventure styling",
          mood: "Desert-strong and arid-beautiful",
          technicalSettings: "Desert lighting with warm, dry atmosphere"
        }
      },
      {
        titles: ["Waterfall wishes and cascade dreams 💦", "Natural power, natural beauty ✨", "Where water meets wonder 🌈"],
        content: "Waterfalls are nature's power displayed - the rush of water, the mist in the air, and that incredible energy that comes from witnessing natural force. These cascade moments capture water magic.",
        photoInstructions: {
          lighting: "Waterfall lighting with mist and water effects",
          cameraAngle: "Cascade angles with water movement",
          composition: "Waterfall compositions with flowing elements",
          styling: "Water-adventure appropriate styling",
          mood: "Waterfall-powerful and cascade-refreshed",
          technicalSettings: "Water lighting with mist and movement effects"
        }
      },
      {
        titles: ["Sunrise hikes and dawn discoveries ☀️", "Early bird, early rewards ✨", "Dawn patrol and morning magic 🌅"],
        content: "Sunrise hikes are worth the early alarm - the quiet trails, the emerging light, and that incredible feeling of having the world to yourself. These dawn moments capture morning magic.",
        photoInstructions: {
          lighting: "Sunrise lighting with dawn colors",
          cameraAngle: "Dawn angles with early morning elements",
          composition: "Sunrise compositions with morning landscape",
          styling: "Early morning adventure styling",
          mood: "Dawn-energized and sunrise-inspired",
          technicalSettings: "Golden hour lighting with sunrise colors"
        }
      },
      {
        titles: ["Camping vibes and starlit nights ⭐", "Under canvas, under stars ✨", "Wilderness luxury at its finest 🏕️"],
        content: "Camping brings out your primal side - simple pleasures, starlit nights, and that incredible connection with the natural world. These wilderness moments capture outdoor elegance.",
        photoInstructions: {
          lighting: "Campfire and starlight camping atmosphere",
          cameraAngle: "Camping angles with outdoor elements",
          composition: "Wilderness compositions with camping integration",
          styling: "Outdoor camping adventure styling",
          mood: "Wilderness-connected and camping-comfortable",
          technicalSettings: "Campfire lighting with natural night atmosphere"
        }
      },
      {
        titles: ["Rock climbing and vertical challenges 🧗‍♀️", "Defying gravity, embracing strength ✨", "When the wall becomes the way 💪"],
        content: "Rock climbing is meditation in motion - the focus, the strength, and that incredible trust in your own ability to reach new heights. These vertical moments capture climbing courage.",
        photoInstructions: {
          lighting: "Climbing lighting with rock face elements",
          cameraAngle: "Vertical angles with climbing action",
          composition: "Rock climbing compositions with height elements",
          styling: "Climbing gear and adventure styling",
          mood: "Vertically challenged and climbing-strong",
          technicalSettings: "Action lighting for climbing movement and strength"
        }
      },
      {
        titles: ["River running and water dancing 🌊", "Liquid highways and flowing freedom ✨", "Where current meets courage 🚣‍♀️"],
        content: "Rivers are liquid highways to adventure - the flowing water, the changing scenery, and that incredible feeling of moving with natural current. These flowing moments capture water freedom.",
        photoInstructions: {
          lighting: "River lighting with flowing water elements",
          cameraAngle: "Water angles with river movement",
          composition: "River compositions with flowing elements",
          styling: "Water adventure appropriate styling",
          mood: "River-free and water-adventurous",
          technicalSettings: "Flowing water lighting with movement and reflection"
        }
      }
    ],
    'professional-tease': [
      {
        titles: ["Office hours, after hours thoughts 💼", "Professional by day, playful by choice ✨", "When business meets pleasure 😉"],
        content: "The office doesn't have to be boring - especially when you know how to work a blazer, make meetings interesting, and turn professional attire into something unexpectedly captivating.",
        photoInstructions: {
          lighting: "Professional office lighting with intimate undertones",
          cameraAngle: "Business angles with subtle personal elements",
          composition: "Office compositions with professional and personal blend",
          styling: "Professional attire with strategic styling",
          mood: "Professionally confident with personal intrigue",
          technicalSettings: "Office lighting with warm personal touches"
        }
      },
      {
        titles: ["Conference room confessions 📊", "Boardroom strategy, bedroom energy ✨", "When presentations get personal 💋"],
        content: "Conference rooms after hours have a different energy - the empty boardroom, the city lights, and that powerful feeling of owning your professional space in your own personal way.",
        photoInstructions: {
          lighting: "Conference room lighting with after-hours ambiance",
          cameraAngle: "Boardroom angles with personal confidence",
          composition: "Professional meeting space with personal elements",
          styling: "Business formal with confident personal touches",
          mood: "Board-room confident and after-hours bold",
          technicalSettings: "Professional lighting with evening executive atmosphere"
        }
      },
      {
        titles: ["Executive decisions, personal preferences 👑", "Corner office, cornerstone confidence ✨", "When leadership looks this good 💼"],
        content: "The corner office isn't just about the view - it's about the power, the confidence, and the way success looks when you're comfortable in your own skin and your own space.",
        photoInstructions: {
          lighting: "Executive lighting with power dynamics",
          cameraAngle: "Authority angles with executive presence",
          composition: "Corner office compositions with leadership elements",
          styling: "Executive attire with authority styling",
          mood: "Executive-powerful and leadership-confident",
          technicalSettings: "Professional executive lighting with authority presence"
        }
      },
      {
        titles: ["Desk drawer secrets and office mysteries 🗄️", "Professional facade, personal reality ✨", "What happens behind closed doors 🚪"],
        content: "Every professional has their secrets - the personality behind the protocol, the person behind the position. These office moments capture what happens when professional meets personal.",
        photoInstructions: {
          lighting: "Office lighting with mysterious personal elements",
          cameraAngle: "Behind-the-scenes professional angles",
          composition: "Office compositions with hidden personal elements",
          styling: "Professional with revealing personal touches",
          mood: "Professionally mysterious and personally intriguing",
          technicalSettings: "Office lighting with personal mystery atmosphere"
        }
      },
      {
        titles: ["Business lunch, personal menu 🥂", "Networking with extra benefits ✨", "When dining becomes designing 🍷"],
        content: "Business lunches just got more interesting - the sophisticated setting, the professional conversation, and that underlying current of something more than just business being discussed.",
        photoInstructions: {
          lighting: "Upscale restaurant lighting with business ambiance",
          cameraAngle: "Professional dining angles with personal chemistry",
          composition: "Business dining compositions with personal undertones",
          styling: "Business dining attire with subtle allure",
          mood: "Business-sophisticated with dining-intimate",
          technicalSettings: "Restaurant lighting with professional dining atmosphere"
        }
      },
      {
        titles: ["Home office, personal policies 💻", "Remote work, intimate perks ✨", "When WFH means working from hot 🔥"],
        content: "Working from home has its advantages - professional on camera, personal below the desk, and the freedom to conduct business exactly how you want to conduct it.",
        photoInstructions: {
          lighting: "Home office lighting with personal comfort",
          cameraAngle: "Work-from-home angles with personal elements",
          composition: "Home office compositions with intimate workspace",
          styling: "Professional/casual hybrid with home comfort",
          mood: "Work-from-home comfortable and professionally personal",
          technicalSettings: "Home office lighting with comfortable professional atmosphere"
        }
      },
      {
        titles: ["Travel business, pleasure principle ✈️", "Hotel rooms and room service ✨", "When business trips get personal 🏨"],
        content: "Business travel isn't all airports and meetings - there are hotel rooms, room service, and those private moments when the business day ends and personal time begins.",
        photoInstructions: {
          lighting: "Hotel lighting with business travel ambiance",
          cameraAngle: "Business travel angles with hotel intimacy",
          composition: "Hotel room compositions with business travel elements",
          styling: "Business travel attire with hotel comfort",
          mood: "Business-travel sophisticated and hotel-intimate",
          technicalSettings: "Hotel lighting with business travel atmosphere"
        }
      },
      {
        titles: ["Lawyer by day, lawless by night ⚖️", "Legal expertise, illegal thoughts ✨", "When justice meets just right 💋"],
        content: "The law is about order, but sometimes the most interesting moments happen in the gray areas - after hours, behind closed doors, when professional boundaries become personal choices.",
        photoInstructions: {
          lighting: "Law office lighting with after-hours atmosphere",
          cameraAngle: "Legal professional angles with personal confidence",
          composition: "Law office compositions with personal elements",
          styling: "Legal professional attire with confident styling",
          mood: "Legally professional and personally confident",
          technicalSettings: "Professional legal lighting with personal authority"
        }
      },
      {
        titles: ["Doctor's orders, patient preferences 🩺", "Medical expertise, bedside manner ✨", "When healthcare becomes self-care 💊"],
        content: "Medical professionals know bodies better than anyone - anatomy, physiology, and exactly what it takes to make someone feel better in every possible way.",
        photoInstructions: {
          lighting: "Medical office lighting with care provider ambiance",
          cameraAngle: "Healthcare professional angles with caring confidence",
          composition: "Medical setting compositions with personal care elements",
          styling: "Medical professional attire with caring styling",
          mood: "Medically professional and caringly confident",
          technicalSettings: "Healthcare lighting with professional care atmosphere"
        }
      },
      {
        titles: ["Teaching moments, learning experiences 📚", "Academic authority, personal curriculum ✨", "When education gets experiential 🎓"],
        content: "Education is about opening minds, and sometimes the most valuable lessons happen outside the classroom - where professional knowledge meets personal experience.",
        photoInstructions: {
          lighting: "Academic lighting with educational authority",
          cameraAngle: "Educational professional angles with teaching confidence",
          composition: "Academic setting compositions with learning elements",
          styling: "Academic professional attire with teaching authority",
          mood: "Academically professional and educationally confident",
          technicalSettings: "Educational lighting with academic authority atmosphere"
        }
      }
    ]
  };
  
  const variations = presetVariations[presetId];
  if (!variations || variations.length === 0) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * variations.length);
  return variations[randomIndex];
}

function generateTitles(params: ContentParameters, photoConfig: any, toneStyle: any): string[] {
  const titles: string[] = [];
  const themes = photoConfig?.themes || ['casual', 'fun', 'spontaneous', 'authentic'];
  const starters = toneStyle?.starters || ['Hey', 'Just', 'So', 'Well'];
  const emojis = toneStyle?.emojis || ['✨', '💕', '🌟', '💫', '🔥'];
  
  // Generate 3-5 varied titles
  titles.push(`${starters[0] || 'Hey'} what happened during my ${themes[0] || 'photo'} session ${emojis[0] || '💫'}`);
  titles.push(`${starters[1] || 'Just'} ${themes[1] || 'content'} content just dropped ${emojis[1] || '🔥'}`);
  titles.push(`${themes[2] || 'Creative'} vibes hit different today ${emojis[2] || '✨'}`);
  
  if (params.photoType === 'all-xs') {
    titles.push(`Warning: ${themes[3] || 'exclusive'} content ahead - not for everyone ${emojis[3] || '🔞'}`);
    titles.push(`${starters[2] || 'Finally'} the limits have been removed ${emojis[4] || '💎'}`);
  } else if (params.photoType === 'very-spicy') {
    titles.push(`${starters[3] || 'Here is'} intense ${themes[3] || 'exclusive'} content ${emojis[3] || '🔥'}`);
  } else if (params.photoType === 'spicy') {
    titles.push(`${themes[3] || 'Spicy'} mood activated ${emojis[3] || '🔥'}`);
  }
  
  return titles.slice(0, Math.random() > 0.5 ? 3 : 4);
}

function generateMainContent(params: ContentParameters, photoConfig: any, toneStyle: any): string {
  let content = "";
  const themes = photoConfig?.themes || ['casual', 'fun', 'spontaneous'];
  const settings = photoConfig?.settings || ['bedroom', 'living room', 'cozy space'];
  const mood = photoConfig?.mood || 'authentic';
  const descriptors = toneStyle?.descriptors || ['amazing', 'beautiful', 'stunning'];
  const endings = toneStyle?.endings || ['hope you enjoy!', 'let me know what you think!'];
  const emojis = toneStyle?.emojis || ['✨', '💕', '🌟'];
  
  // Opening based on tone and photo type
  if (params.textTone === 'confident') {
    const randomStarter = (toneStyle?.starters || ['Here is'])[Math.floor(Math.random() * (toneStyle?.starters?.length || 1))];
    content = `${randomStarter} ${descriptors[0]} content I just created. `;
  } else if (params.textTone === 'playful') {
    const randomStarter = (toneStyle?.starters || ['Hey'])[Math.floor(Math.random() * (toneStyle?.starters?.length || 1))];
    content = `${randomStarter} I had the most ${descriptors[0]} photoshoot in my ${settings[0]} today! `;
  } else if (params.textTone === 'mysterious') {
    const randomStarter = (toneStyle?.starters || ['Something happened'])[Math.floor(Math.random() * (toneStyle?.starters?.length || 1))];
    content = `${randomStarter} in my ${settings[0]}... `;
  } else if (params.textTone === 'sassy') {
    const randomStarter = (toneStyle?.starters || ['Listen up'])[Math.floor(Math.random() * (toneStyle?.starters?.length || 1))];
    content = `${randomStarter}, your girl just dropped some ${descriptors[0]} content. `;
  } else {
    const randomStarter = (toneStyle?.starters || ['Hey there'])[Math.floor(Math.random() * (toneStyle?.starters?.length || 1))];
    content = `${randomStarter}, this ${themes[0]} session was ${descriptors[0]}. `;
  }
  
  // Middle content based on photo type
  if (params.photoType === 'casual') {
    content += `Just me being my natural self - coffee in hand, messy hair, and that perfect morning light streaming through the window. `;
  } else if (params.photoType === 'workout') {
    content += `Post-workout glow hits different when you've pushed your limits. Sweat, determination, and feeling absolutely powerful. `;
  } else if (params.photoType === 'shower') {
    content += `There's something magical about water, steam, and that peaceful moment when it's just you and your thoughts. `;
  } else if (params.photoType === 'showing-skin') {
    content += `Artistic expression meets body confidence. Every curve tells a story, every shadow creates beauty. `;
  } else if (params.photoType === 'spicy') {
    content += `When the mood strikes and you decide to turn up the heat. Silk, shadows, and that look that says everything. `;
  } else if (params.photoType === 'very-spicy') {
    content += `No holding back today. Raw passion, artistic nudity, and content that pushes every boundary I have. `;
  } else if (params.photoType === 'all-xs') {
    content += `Complete creative freedom unleashed. No limits, no boundaries, just pure artistic expression in its rawest form. `;
  }
  
  // Add custom prompt integration
  if (params.customPrompt) {
    content += `${params.customPrompt} `;
  }
  
  // Promotion integration
  if (params.includePromotion) {
    if (params.textTone === 'confident') {
      content += `This exclusive content is available for my VIP subscribers who appreciate quality. `;
    } else if (params.textTone === 'playful') {
      content += `The full collection is waiting for my special subscribers! `;
    } else if (params.textTone === 'mysterious') {
      content += `But that's all you see here... the rest remains in the shadows for those who seek it. `;
    } else if (params.textTone === 'sassy') {
      content += `If you want the full experience, you know where to find me. `;
    } else {
      content += `The complete series is available for subscribers who want the authentic experience. `;
    }
  }
  
  // Ending with hashtags if selected
  content += endings[Math.floor(Math.random() * endings.length)];
  
  if (params.selectedHashtags.length > 0) {
    content += ` ${params.selectedHashtags.join(' ')}`;
  }
  
  return content;
}

function generatePhotoInstructions(params: ContentParameters, photoConfig: any): any {
  const config = photoConfig;
  
  return {
    lighting: config.lighting + (params.photoType === 'shower' ? ', emphasis on steam and water reflections' : 
               params.photoType === 'workout' ? ', bright and energetic to show determination' :
               params.photoType === 'very-spicy' || params.photoType === 'all-xs' ? ', dramatic contrasts and artistic shadows' : ''),
    angles: config.angles + (params.textTone === 'confident' ? ', powerful perspective shots' :
            params.textTone === 'playful' ? ', fun candid angles' :
            params.textTone === 'mysterious' ? ', shadowy artistic angles' : ''),
    composition: `${config.mood} composition with ${params.photoType === 'casual' ? 'natural framing' :
                 params.photoType === 'workout' ? 'dynamic action elements' :
                 params.photoType === 'shower' ? 'steam and water elements' :
                 params.photoType === 'showing-skin' ? 'artistic tasteful framing' :
                 params.photoType === 'spicy' ? 'seductive elegant framing' :
                 params.photoType === 'very-spicy' ? 'bold intimate framing' :
                 'unlimited creative framing'}`,
    styling: `${config.clothing.join(' or ')}, ${config.mood} aesthetic`,
    technical: `High resolution, sharp focus, professional quality${params.photoType === 'very-spicy' || params.photoType === 'all-xs' ? ', studio-grade equipment recommended' : ''}`,
    sceneSetup: `${config.settings.join(' or ')}, ${params.photoType} theme environment`
  };
}

function generateTags(params: ContentParameters, photoConfig: any): string[] {
  const baseTags = [params.photoType, params.textTone, params.platform];
  const photoTags = photoConfig.themes.slice(0, 2);
  const moodTags = [photoConfig.mood];
  
  return [...baseTags, ...photoTags, ...moodTags].map(tag => 
    tag.replace(/ /g, '-').toLowerCase()
  );
}