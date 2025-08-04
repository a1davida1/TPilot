interface GeneratedContent {
  titles: string[];
  content: string;
  photoInstructions: {
    lighting: string[];
    angles: string[];
    composition: string[];
    styling: string[];
    technical: string[];
  };
}

const contentTemplates = {
  reddit: {
    playful: {
      titles: [
        "First time posting here... be gentle 💕",
        "Lazy Sunday vibes ✨ What would you do with me?",
        "Coffee in bed hits different when you're like this ☕",
        "Just got out of the shower and feeling myself 💦",
        "Morning light hitting just right today 🌅"
      ],
      content: "Just got out of the shower and feeling absolutely amazing! 💦✨\n\nThere's something so liberating about these quiet moments... What are you up to this evening? 😘\n\n#selfcare #confidence #authentic"
    },
    mysterious: {
      titles: [
        "What secrets do my eyes hold? 👁️",
        "Shadow and light tell stories... what's mine saying?",
        "Some mysteries are worth discovering 🖤",
        "Behind closed doors, who am I really?",
        "The darkness reveals more than light ever could"
      ],
      content: "There's something intoxicating about the unknown, don't you think? 🌙\n\nIn shadows, we find our truest selves... What would you discover about me?\n\n#mysterious #alluring #secrets"
    },
    bold: {
      titles: [
        "Confidence is my favorite outfit 💪",
        "Taking up space and loving every inch of it",
        "Bold moves only - life's too short for maybe",
        "Here's to being unapologetically me 🔥",
        "Fierce energy, unstoppable attitude"
      ],
      content: "Life's too short to play it safe, don't you think? 🔥\n\nI'm here, I'm bold, and I'm owning every moment. What bold move are you making today?\n\n#confidence #fierce #unapologetic"
    },
    elegant: {
      titles: [
        "Grace in every movement, beauty in simplicity ✨",
        "Elegance is the only beauty that never fades",
        "Soft curves, gentle light, timeless allure",
        "Classic beauty with a modern twist 🤍",
        "Sophistication speaks louder than words"
      ],
      content: "There's something timeless about quiet elegance, isn't there? ✨\n\nIn a world of noise, I choose grace. What speaks to your soul today?\n\n#elegant #timeless #sophisticated"
    }
  }
};

const photoInstructionTemplates = {
  lifestyle: {
    lighting: [
      "Soft natural light from large window",
      "Use sheer curtains to diffuse harsh sunlight", 
      "Golden hour timing (1 hour before sunset)",
      "Avoid direct overhead lighting"
    ],
    angles: [
      "Slightly above eye level for flattering perspective",
      "45-degree angle for natural shadows",
      "Leave negative space around subject",
      "Use timer or remote for natural poses"
    ],
    composition: [
      "Clean, minimal background",
      "Use rule of thirds for positioning", 
      "Include contextual elements (coffee, books, plants)",
      "Multiple shots with different expressions"
    ],
    styling: [
      "Relaxed, natural poses",
      "Subtle makeup for fresh look",
      "Comfortable, flattering clothing",
      "Props that match the story theme"
    ],
    technical: [
      "Portrait mode for background blur",
      "High resolution for cropping flexibility",
      "Multiple exposures for best lighting",
      "Focus on eyes for portrait shots"
    ]
  },
  fashion: {
    lighting: [
      "Even, diffused lighting setup",
      "Ring light or softbox for consistent illumination",
      "Avoid harsh shadows on fabric textures",
      "Side lighting to highlight clothing details"
    ],
    angles: [
      "Eye level for outfit showcase",
      "Full body shots from slight distance",
      "Detail shots of accessories and textures",
      "Multiple angles to show garment movement"
    ],
    composition: [
      "Neutral background to highlight outfit",
      "Vertical framing for full-body shots",
      "Include styling accessories strategically",
      "Clean, uncluttered composition"
    ],
    styling: [
      "Confident, fashion-forward poses",
      "Coordinated makeup with outfit colors",
      "Attention to garment fit and draping",
      "Accessories that complement the look"
    ],
    technical: [
      "Sharp focus on clothing details",
      "Proper white balance for true colors",
      "Higher aperture for garment sharpness",
      "Consistent lighting across multiple shots"
    ]
  },
  artistic: {
    lighting: [
      "Dramatic lighting with strong contrasts",
      "Play with shadows and highlights",
      "Colored gels for mood lighting",
      "Creative use of practical lights"
    ],
    angles: [
      "Experimental and unconventional angles",
      "Close-ups for abstract compositions",
      "Low or high angles for dramatic effect",
      "Multiple perspectives for storytelling"
    ],
    composition: [
      "Break traditional composition rules",
      "Use leading lines and geometric shapes",
      "Negative space as part of the art",
      "Layered elements for visual depth"
    ],
    styling: [
      "Bold, artistic poses and expressions",
      "Creative makeup and styling choices",
      "Wardrobe that supports the artistic vision",
      "Props that enhance the narrative"
    ],
    technical: [
      "Experiment with different focal lengths",
      "Creative use of depth of field",
      "Post-processing for artistic effect",
      "Multiple exposures for creative blending"
    ]
  }
};

export async function generateContent(
  platform: string,
  style: string,
  theme: string
): Promise<GeneratedContent> {
  // Get content template based on platform and style
  const platformTemplates = contentTemplates[platform as keyof typeof contentTemplates];
  if (!platformTemplates) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const styleTemplate = platformTemplates[style as keyof typeof platformTemplates];
  if (!styleTemplate) {
    throw new Error(`Unsupported style: ${style} for platform: ${platform}`);
  }

  // Get photo instructions based on theme
  const instructionTemplate = photoInstructionTemplates[theme as keyof typeof photoInstructionTemplates];
  if (!instructionTemplate) {
    throw new Error(`Unsupported theme: ${theme}`);
  }

  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    titles: styleTemplate.titles,
    content: styleTemplate.content,
    photoInstructions: instructionTemplate
  };
}
