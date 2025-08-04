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
        "First time posting... should I be nervous? 😇",
        "Just turned 18 and feeling adventurous 💕",
        "My roommate's gone for the weekend... what should I do? 😈",
        "Fresh out of the shower and feeling naughty 💦",
        "Daddy said I've been a good girl... do you agree? 🥺"
      ],
      content: "Just got verified and I'm already getting so many sweet messages! 💕\n\nI love how friendly everyone is here... maybe I should post more often? What do you think I should show you next? 😘",
      contentWithPromo: "Just got verified and I'm already getting so many sweet messages! 💕\n\nI love how friendly everyone is here... maybe I should post more often? What do you think I should show you next? 😘\n\nCheck my bio for more exclusive content 💋\nDM me for custom requests! 🔥"
    },
    mysterious: {
      titles: [
        "What would you do if you found me like this? 🌙",
        "The things I do when nobody's watching... 🖤",
        "Some secrets are too delicious to keep hidden",
        "Behind this innocent face lies something darker 😈",
        "You have no idea what I'm capable of..."
      ],
      content: "There's so much more to me than meets the eye... 🌙\n\nI have fantasies that would make you blush. Want to know what they are?\n\nDM me if you think you can handle the real me 💋\n\n#mysterious #naughty #secrets"
    },
    bold: {
      titles: [
        "I know exactly what you're thinking right now 🔥",
        "Confidence looks good on me, doesn't it?",
        "I dare you to tell me what you'd do to me",
        "No limits, no boundaries, just pure desire 💋",
        "Think you can handle all of this? Prove it"
      ],
      content: "I'm not here to play games or be subtle 🔥\n\nI know what I want and I'm not afraid to ask for it. The question is... are you brave enough to give it to me?\n\nSlide into my DMs and show me what you're made of 😈\n\n#confident #bold #nolimits"
    },
    elegant: {
      titles: [
        "Sophistication with a sinful twist ✨",
        "Class in the streets, freak in the sheets",
        "Pearls and lace hide the wildest desires",
        "Refined on the outside, insatiable within 🤍",
        "Elegance is knowing exactly how to drive you wild"
      ],
      content: "There's an art to seduction that goes beyond the obvious ✨\n\nI believe in building anticipation... making you crave every reveal. True elegance is knowing when to tease and when to please.\n\nFor those with refined tastes, check my exclusive content 💎\n\n#elegant #sophisticated #classy"
    },
    shy: {
      titles: [
        "I'm so nervous to post this... please be nice 🥺",
        "First time showing this much... am I doing okay?",
        "Too shy to show my face but... here's the rest 😊",
        "My friend dared me to post... what do you think?",
        "Still learning to be confident... rate me gently? 💕"
      ],
      content: "I'm still so new to this and honestly a bit scared... 🥺\n\nBut everyone here seems so sweet! Maybe you could help boost my confidence? Your comments mean everything to a shy girl like me.\n\nI promise I'll get braver if you're nice to me 💕\n\n#shy #nervous #beginner"
    },
    naughty: {
      titles: [
        "Being a bad girl while parents are out 😈",
        "Can't sleep... anyone want to keep me company?",
        "Feeling so horny right now... help me out? 💦",
        "Just did something very naughty... wanna see?",
        "Late night cravings got me acting up again 🔥"
      ],
      content: "I've been such a naughty girl today and I can't help myself 😈\n\nI need someone to tell me exactly what they'd do to me... the dirtier the better. I'm already so wet just thinking about it 💦\n\nDM me your fantasies - I reply to everyone tonight 🔥\n\n#naughty #horny #wetandready"
    },
    kinky: {
      titles: [
        "Looking for someone to explore my darker side with 🖤",
        "Vanilla is boring... who wants to get freaky?",
        "I have some very specific needs... can you handle them?",
        "Ready to be your perfect little submissive tonight 😈",
        "Daddy issues and rope marks - your type? 🔗"
      ],
      content: "I'm not your average girl next door... I crave things that would shock most people 🖤\n\nI love being tied up, spanked, and told exactly what to do. The rougher the better. I'm your perfect little toy if you know how to use me right.\n\nOnly real doms in my DMs - prove you can handle me 😈\n\n#kinky #submissive #bdsm #roughplay"
    }
  }
};

const photoInstructionTemplates = {
  tease: {
    lighting: ["Natural window light works best"],
    angles: ["Use your phone timer"],
    composition: ["Keep your bedroom/bathroom tidy"],
    styling: ["Start fully clothed"],
    technical: [
      "Photo 1: Fully clothed, cute smile",
      "Photo 2: Remove your top, cover with hands",
      "Photo 3: Hands away, show everything",
      "Photo 4: Turn around, look over shoulder",
      "Photo 5: Your choice - get creative!"
    ]
  },
  shower: {
    lighting: ["Bathroom lighting is fine"],
    angles: ["Mirror selfies work great"],
    composition: ["Steam up the mirror a bit"],
    styling: ["Start with a towel"],
    technical: [
      "Photo 1: Wrapped in towel after shower",
      "Photo 2: Towel dropped to waist",
      "Photo 3: Towel around ankles",
      "Photo 4: Towel on floor, you're free",
      "Photo 5: Wet hair, confident pose"
    ]
  },
  lingerie: {
    lighting: ["Dim bedroom lighting"],
    angles: ["Bed selfies are perfect"],
    composition: ["Messy bed is actually better"],
    styling: ["Wear your sexiest lingerie"],
    technical: [
      "Photo 1: Full lingerie set, innocent pose",
      "Photo 2: Bra off, cover with arm",
      "Photo 3: Topless, confident look",
      "Photo 4: Everything off, artistic pose",
      "Photo 5: Whatever makes you feel powerful"
    ]
  },
  slutty: {
    lighting: ["Bright lighting to show everything"],
    angles: ["Get close, show the details"],
    composition: ["Don't worry about being classy"],
    styling: ["Wear the sluttiest outfit you have"],
    technical: [
      "Photo 1: Slutty outfit, bend over pose",
      "Photo 2: Top off, push up your tits",
      "Photo 3: Spread your legs, show pussy",
      "Photo 4: Ass up, face down position",
      "Photo 5: Completely naked, legs wide open"
    ]
  },
  nude: {
    lighting: ["Whatever lighting you have"],
    angles: ["Full body shots"],
    composition: ["Show everything clearly"],
    styling: ["Start completely naked"],
    technical: [
      "Photo 1: Standing nude, hands at sides",
      "Photo 2: Bent over showing ass and pussy",
      "Photo 3: Lying down, legs spread wide",
      "Photo 4: On knees, tits pushed together",
      "Photo 5: Whatever slutty pose you want"
    ]
  }
};

export async function generateContent(
  platform: string,
  style: string,
  theme: string,
  timing?: string,
  allowsPromotion?: string
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

  // Choose content based on whether promotion is allowed
  const finalContent = allowsPromotion === "yes" && styleTemplate.contentWithPromo 
    ? styleTemplate.contentWithPromo 
    : styleTemplate.content;

  return {
    titles: styleTemplate.titles,
    content: finalContent,
    photoInstructions: instructionTemplate
  };
}
