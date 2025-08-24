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
    ]
    // ... Continue with remaining presets (workout-clothes, lingerie, casual-tease, bedroom-scene, outdoor-adventure, professional-tease)
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