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