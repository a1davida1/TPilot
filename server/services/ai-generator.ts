import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Demo content generator for when API is unavailable
function generateDemoContent(request: AIGenerationRequest): AIContentResponse {
  const { customPrompt, platform, allowsPromotion, style, theme } = request;
  
  // Generate content based on style and theme
  let demoVariations: any[];
  
  // Check if this is adult/nude content style
  const isAdultContent = style?.includes('nude') || theme?.includes('nude') || 
                         style?.includes('sexy') || theme?.includes('sexy') ||
                         style?.includes('sensual') || theme?.includes('sensual');
  
  if (isAdultContent) {
    demoVariations = [
      {
        titles: ["Feeling absolutely stunning today 💋", "When confidence meets beauty ✨", "Natural beauty at its finest 🌸"],
        content: "Embracing my natural beauty and feeling incredibly confident today. There's something so empowering about feeling comfortable in your own skin and celebrating who you are.",
        photoInstructions: {
          lighting: "Soft, flattering lighting - golden hour or warm indoor lighting works beautifully",
          cameraAngle: "Eye level or slightly above - creates intimate connection while remaining flattering",
          composition: "Focus on natural poses and authentic expressions that showcase your personality",
          styling: "Whatever makes you feel confident and beautiful - authenticity is most important",
          mood: "Confident, alluring, and genuinely comfortable in your own skin",
          technicalSettings: "Good focus with soft background - keep attention on you as the subject"
        }
      },
      {
        titles: ["Sunset vibes and good energy ☀️", "Golden hour goddess moments ✨", "Chasing light and feeling divine 🌅"],
        content: "There's magic in these golden hour moments when everything feels perfect. Capturing the light, the mood, and this feeling of pure confidence.",
        photoInstructions: {
          lighting: "Golden hour lighting for that warm, ethereal glow",
          cameraAngle: "Slightly below eye level for an empowering perspective",
          composition: "Silhouettes and backlighting for dramatic effect",
          styling: "Flowing fabrics that catch the light beautifully",
          mood: "Dreamy, ethereal, and goddess-like",
          technicalSettings: "Shoot into the light for that magical rim lighting effect"
        }
      },
      {
        titles: ["Bedroom eyes and morning light 😍", "Lazy Sunday vibes and soft skin ☁️", "Intimate moments and gentle touches 💕"],
        content: "These quiet, intimate moments are my favorite to capture. When the light is soft and everything feels gentle and peaceful.",
        photoInstructions: {
          lighting: "Soft morning light through sheer curtains",
          cameraAngle: "Close-up and intimate angles",
          composition: "Focus on details - curves, textures, gentle expressions",
          styling: "Minimal, comfortable pieces that feel natural",
          mood: "Intimate, soft, and genuinely relaxed",
          technicalSettings: "Shallow depth of field for dreamy bokeh"
        }
      },
      {
        titles: ["Confidence level: unstoppable 🔥", "Owning my power and loving it 💪", "Boss energy in full effect ⚡"],
        content: "Feeling incredibly empowered and confident today. There's something so beautiful about knowing your worth and owning your space.",
        photoInstructions: {
          lighting: "Bold, dramatic lighting with strong shadows",
          cameraAngle: "Powerful angles that emphasize strength",
          composition: "Strong poses that show confidence and authority",
          styling: "Statement pieces that make you feel powerful",
          mood: "Bold, confident, and commanding",
          technicalSettings: "High contrast for dramatic impact"
        }
      },
      {
        titles: ["Artistic mood and creative energy 🎨", "When art meets beauty perfectly ✨", "Creative souls and expressive moments 🌙"],
        content: "Exploring the artistic side of photography and self-expression. These creative moments where everything comes together beautifully.",
        photoInstructions: {
          lighting: "Creative lighting setups with colored gels or shadows",
          cameraAngle: "Unique perspectives and artistic compositions",
          composition: "Rule-breaking compositions for artistic effect",
          styling: "Avant-garde or artistic styling choices",
          mood: "Creative, expressive, and artistically inspired",
          technicalSettings: "Experimental settings for artistic effects"
        }
      },
      {
        titles: ["Midnight muse and moonlight magic 🌙", "Dark romance and mysterious vibes ✨", "Shadow play and secret moments 🖤"],
        content: "There's something captivating about these darker, more mysterious moments. Playing with shadows and embracing the night.",
        photoInstructions: {
          lighting: "Low-key lighting with dramatic shadows",
          cameraAngle: "Mysterious angles that hide and reveal",
          composition: "Shadow play and negative space",
          styling: "Dark, romantic, or mysterious styling",
          mood: "Mysterious, romantic, and alluring",
          technicalSettings: "Low light techniques for moody atmosphere"
        }
      },
      {
        titles: ["Pure joy and authentic smiles 😊", "Happiness looks good on me ✨", "Genuine moments of pure bliss 💫"],
        content: "Sometimes the most beautiful content comes from genuine happiness and joy. These are the moments that feel most authentically me.",
        photoInstructions: {
          lighting: "Bright, cheerful lighting that matches the mood",
          cameraAngle: "Angles that capture genuine emotion",
          composition: "Candid-feeling shots that show real joy",
          styling: "Comfortable, happy styling that feels authentic",
          mood: "Joyful, authentic, and genuinely happy",
          technicalSettings: "Settings that capture the energy and movement"
        }
      },
      {
        titles: ["Elegance meets sensuality perfectly 💎", "Sophisticated vibes and timeless beauty ✨", "Classic beauty with modern edge 🌹"],
        content: "Combining elegance with allure for that perfect balance. These sophisticated moments that feel both timeless and modern.",
        photoInstructions: {
          lighting: "Elegant, sophisticated lighting schemes",
          cameraAngle: "Classic portrait angles with modern flair",
          composition: "Timeless compositions with contemporary edge",
          styling: "Elegant pieces that enhance natural beauty",
          mood: "Sophisticated, elegant, and refined",
          technicalSettings: "Crisp, clean technical execution"
        }
      },
      {
        titles: ["Wild spirit and free soul 🦋", "Untamed beauty and natural grace ✨", "Free-spirited moments and wild hearts 🌿"],
        content: "Embracing my wild, free spirit and celebrating the beauty of being unapologetically myself. These untamed moments feel so authentic.",
        photoInstructions: {
          lighting: "Natural, uncontrolled lighting for authenticity",
          cameraAngle: "Free-flowing angles that capture movement",
          composition: "Organic compositions that feel unposed",
          styling: "Bohemian or free-spirited styling choices",
          mood: "Wild, free, and authentically unrestrained",
          technicalSettings: "Capturing movement and spontaneity"
        }
      },
      {
        titles: ["Dreamy afternoons and soft moments ☁️", "Ethereal beauty and gentle vibes ✨", "Soft focus and tender feelings 💕"],
        content: "These dreamy, soft moments where everything feels gentle and beautiful. Capturing the ethereal side of beauty and self-expression.",
        photoInstructions: {
          lighting: "Soft, diffused lighting for ethereal effect",
          cameraAngle: "Gentle angles that enhance softness",
          composition: "Dreamy compositions with soft focus elements",
          styling: "Flowing, soft fabrics and gentle styling",
          mood: "Dreamy, soft, and ethereally beautiful",
          technicalSettings: "Soft focus techniques for dreamy atmosphere"
        }
      }
    ];
  } else {
    demoVariations = [
      {
        titles: ["Just had the most amazing day! ✨", "Feeling confident and loving life 💫", "Sometimes you just gotta shine your own light ✨"],
        content: "Today was absolutely incredible! Sometimes you just have those days where everything feels perfect and you're reminded of how amazing life can be.",
        photoInstructions: {
          lighting: "Soft natural light from a window - creates a warm, inviting glow",
          cameraAngle: "Slightly above eye level - universally flattering angle",
          composition: "Rule of thirds with you positioned off-center",
          styling: "Your signature style with confidence",
          mood: "Happy, confident, and genuinely joyful",
          technicalSettings: "Portrait mode with soft background blur"
        }
      },
      {
        titles: ["Coffee dates with myself ☕", "Morning rituals and good vibes ✨", "Starting the day with intention 🌅"],
        content: "There's something so peaceful about morning coffee and taking time for yourself. These quiet moments set the tone for the entire day.",
        photoInstructions: {
          lighting: "Soft morning light with warm tones",
          cameraAngle: "Casual, lifestyle angles",
          composition: "Include props like coffee cups for storytelling",
          styling: "Comfortable, cozy morning wear",
          mood: "Peaceful, centered, and content",
          technicalSettings: "Natural lighting with warm white balance"
        }
      },
      {
        titles: ["Adventure calls and I answer 🏔️", "Exploring new places and finding magic ✨", "Wanderlust and wonderful discoveries 🗺️"],
        content: "Always ready for the next adventure! There's so much beauty in exploring new places and pushing your comfort zone.",
        photoInstructions: {
          lighting: "Natural outdoor lighting",
          cameraAngle: "Environmental shots showing scale and adventure",
          composition: "Include landscape elements for context",
          styling: "Adventure-appropriate clothing",
          mood: "Adventurous, excited, and free-spirited",
          technicalSettings: "Wide-angle shots to capture the environment"
        }
      },
      {
        titles: ["Cozy nights and good books 📚", "Home is where the heart is 🏠", "Simple pleasures and peaceful moments ✨"],
        content: "Finding joy in the simple things - cozy nights at home, good books, and peaceful moments. These are the times that recharge my soul.",
        photoInstructions: {
          lighting: "Warm, cozy indoor lighting",
          cameraAngle: "Intimate, close-up angles",
          composition: "Include cozy elements like books, blankets",
          styling: "Comfortable, homey clothing",
          mood: "Cozy, peaceful, and content",
          technicalSettings: "Warm lighting to enhance the cozy feeling"
        }
      },
      {
        titles: ["Friendship and laughter therapy 😂", "Good friends make everything better ✨", "Squad goals and endless giggles 👯"],
        content: "Spending time with amazing friends who make you laugh until your cheeks hurt. These are the moments that matter most.",
        photoInstructions: {
          lighting: "Bright, cheerful lighting",
          cameraAngle: "Group shots and candid moments",
          composition: "Include friends and capture interactions",
          styling: "Fun, casual group styling",
          mood: "Joyful, social, and energetic",
          technicalSettings: "Fast shutter to capture candid laughter"
        }
      },
      {
        titles: ["Creative projects and artistic flow 🎨", "When inspiration strikes perfectly ✨", "Making something beautiful today 💫"],
        content: "Lost in a creative project and loving every minute of it. There's something magical about when inspiration hits and everything flows.",
        photoInstructions: {
          lighting: "Bright, inspiring lighting for creativity",
          cameraAngle: "Process shots showing creativity in action",
          composition: "Include creative tools and works in progress",
          styling: "Comfortable clothes for creating",
          mood: "Inspired, focused, and creatively energized",
          technicalSettings: "Good lighting to show creative details"
        }
      },
      {
        titles: ["Fitness goals and feeling strong 💪", "Healthy body, happy mind ✨", "Celebrating what my body can do 🏃‍♀️"],
        content: "Feeling strong and celebrating everything my body can do. Fitness isn't just about appearance - it's about feeling powerful and healthy.",
        photoInstructions: {
          lighting: "Energetic, motivating lighting",
          cameraAngle: "Action shots that show strength",
          composition: "Dynamic compositions showing movement",
          styling: "Athletic wear that makes you feel strong",
          mood: "Powerful, energetic, and motivated",
          technicalSettings: "Fast shutter to capture movement"
        }
      },
      {
        titles: ["Learning new things and growing 📖", "Personal growth and good choices ✨", "Investing in myself every day 🌱"],
        content: "Always learning, always growing. Investing time in personal development and celebrating the journey of becoming your best self.",
        photoInstructions: {
          lighting: "Clean, focused lighting",
          cameraAngle: "Thoughtful, contemplative angles",
          composition: "Include learning materials or growth symbols",
          styling: "Professional or study-appropriate clothing",
          mood: "Thoughtful, determined, and growth-oriented",
          technicalSettings: "Clear, sharp focus for professional feel"
        }
      },
      {
        titles: ["Nature therapy and fresh air 🌳", "Finding peace in green spaces ✨", "Earth connection and natural beauty 🌿"],
        content: "Nothing beats time in nature for clearing the mind and finding peace. These outdoor moments remind me what really matters.",
        photoInstructions: {
          lighting: "Natural outdoor lighting",
          cameraAngle: "Environmental portraits in nature",
          composition: "Include natural elements like trees, flowers",
          styling: "Outdoor-appropriate, natural styling",
          mood: "Peaceful, grounded, and naturally beautiful",
          technicalSettings: "Natural lighting with nature backgrounds"
        }
      },
      {
        titles: ["Celebrating small wins today 🎉", "Progress over perfection always ✨", "Grateful for how far I've come 🙏"],
        content: "Taking time to celebrate the small victories and acknowledge progress. Every step forward is worth celebrating, no matter how small.",
        photoInstructions: {
          lighting: "Celebratory, uplifting lighting",
          cameraAngle: "Confident, celebratory angles",
          composition: "Positive, uplifting compositions",
          styling: "Styling that makes you feel accomplished",
          mood: "Celebratory, grateful, and accomplished",
          technicalSettings: "Bright, positive lighting setup"
        }
      }
    ];
  }

  // Randomly select one of the 10 variations
  const randomIndex = Math.floor(Math.random() * demoVariations.length);
  const selectedVariation = demoVariations[randomIndex];
  
  // If user provided a custom prompt, modify the content
  if (customPrompt) {
    selectedVariation.content = `[AI QUOTA EXCEEDED - Demo Content]\n\nThis would be personalized content for: "${customPrompt}"\n\nStyle: ${style || (isAdultContent ? 'sensual' : 'casual')}\nPlatform: ${platform}\n\nThe full AI would create engaging, authentic content that matches your exact style and voice. ${allowsPromotion === 'high' ? 'With subtle promotional elements included.' : 'Focused on genuine connection.'}\n\nUpgrade your OpenAI plan to enable real AI generation! 🚀`;
  } else {
    selectedVariation.content = `[AI QUOTA EXCEEDED - Demo Content]\n\n${selectedVariation.content}\n\nThis is demo content #${randomIndex + 1} of 10 variations. The full AI would create personalized ${platform} content that matches your exact voice, style, and brand.\n\nReady for real AI-powered content creation? ✨`;
  }

  return selectedVariation;
}

interface User {
  personalityProfile: {
    toneOfVoice: string;
    contentStyle: string;
    personalBrand: string;
    contentLength: 'short' | 'medium' | 'long';
    includeEmojis: boolean;
    promotionLevel: 'subtle' | 'moderate' | 'direct';
  };
  preferences: any;
}

interface AIGenerationRequest {
  user: User;
  platform: string;
  imageDescription?: string;
  customPrompt?: string;
  subreddit?: string;
  allowsPromotion: 'yes' | 'no' | 'high';
  baseImageUrl?: string;
  style?: string;
  theme?: string;
}

interface AIContentResponse {
  titles: string[];
  content: string;
  photoInstructions: {
    lighting: string;
    cameraAngle: string;
    composition: string;
    styling: string;
    mood: string;
    technicalSettings: string;
  };
}

export async function generateAIContent(request: AIGenerationRequest): Promise<AIContentResponse> {
  const { user, platform, imageDescription, customPrompt, subreddit, allowsPromotion } = request;
  const profile = user.personalityProfile;

  // Build context for AI generation
  const contextPrompt = buildContextPrompt(profile, platform, allowsPromotion, subreddit);
  
  let mainPrompt = '';
  if (customPrompt) {
    mainPrompt = `Create content based on this request: "${customPrompt}"`;
  } else if (imageDescription) {
    mainPrompt = `Create content based on this image: ${imageDescription}`;
  } else {
    mainPrompt = 'Create engaging content that fits my personality and brand.';
  }

  const fullPrompt = `
${contextPrompt}

${mainPrompt}

Please respond with JSON in this exact format:
{
  "titles": ["title1", "title2", "title3"],
  "content": "main post content",
  "photoInstructions": {
    "lighting": "lighting description",
    "cameraAngle": "camera angle description", 
    "composition": "composition description",
    "styling": "styling description",
    "mood": "mood description",
    "technicalSettings": "technical settings description"
  }
}

Generate 3 different title options. Make the content engaging and authentic to my personality.
${profile.includeEmojis ? 'Include appropriate emojis.' : 'Do not use emojis.'}
Content length should be ${profile.contentLength}.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert social media content creator specializing in adult content creation. Create engaging, authentic content that respects platform guidelines while being appealing and personality-driven."
        },
        {
          role: "user",
          content: fullPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.8
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate and format the response
    return {
      titles: Array.isArray(result.titles) ? result.titles.slice(0, 3) : ['Generated Title'],
      content: result.content || 'Generated content',
      photoInstructions: {
        lighting: result.photoInstructions?.lighting || 'Natural lighting preferred',
        cameraAngle: result.photoInstructions?.cameraAngle || 'Eye level angle',
        composition: result.photoInstructions?.composition || 'Center composition',
        styling: result.photoInstructions?.styling || 'Casual styling',
        mood: result.photoInstructions?.mood || 'Confident and natural',
        technicalSettings: result.photoInstructions?.technicalSettings || 'Auto settings'
      }
    };
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Fallback to demo content for testing/quota issues
    return generateDemoContent(request);
  }
}

export async function analyzeImageForContent(imageUrl: string, user: User): Promise<string> {
  try {
    // For local development, we'll use a simplified approach
    // In production, you'd want to fetch the image and convert to base64
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing images for social media content creation. Describe what you see in a way that would help create engaging post content."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and describe it in detail for creating social media content. Focus on the mood, setting, styling, and elements that would make for engaging post content. Keep the description concise but vivid.`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    return response.choices[0].message.content || 'Image shows an engaging scene perfect for social media content.';
  } catch (error) {
    console.error('Image analysis error:', error);
    // Fallback description
    return 'Image shows an attractive scene that would work well for engaging social media content.';
  }
}

function buildContextPrompt(
  profile: User['personalityProfile'], 
  platform: string, 
  allowsPromotion: 'yes' | 'no',
  subreddit?: string
): string {
  let context = `
You are creating content for ${platform}${subreddit ? ` (specifically for r/${subreddit})` : ''}.

Personality Profile:
- Tone of Voice: ${profile.toneOfVoice}
- Content Style: ${profile.contentStyle}
- Personal Brand: ${profile.personalBrand}
- Promotion Level: ${profile.promotionLevel}

`;

  if (allowsPromotion === 'yes') {
    context += `This platform/subreddit allows promotional content, so you can be more direct about promoting content or services.`;
  } else {
    context += `This platform/subreddit does not allow promotional content, so keep it subtle and focus on genuine engagement.`;
  }

  // Add platform-specific guidance
  if (platform === 'reddit') {
    context += `\n\nReddit-specific guidelines:
- Be authentic and conversational
- Avoid overly promotional language unless explicitly allowed
- Focus on community engagement
- Use Reddit's casual tone`;
  }

  return context;
}