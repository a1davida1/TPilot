import OpenAI from 'openai';
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function generateAIContent(request) {
    const { customPrompt, platform, allowsPromotion, style, theme, imageBase64 } = request;
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('AI service not configured. Please contact support.');
        }
        // Build the prompt for AI generation
        const promotionText = allowsPromotion === 'yes' || allowsPromotion === 'high' ?
            'Include subtle promotional elements.' :
            'Focus on authentic engagement without promotion.';
        const basePrompt = `Generate social media content for ${platform}.
Style: ${style || 'casual'}
Theme: ${theme || 'lifestyle'}
${promotionText}
${customPrompt || ''}

Please provide:
1. Three different title options
2. Engaging post content
3. Photo instructions (lighting, camera angle, composition, styling, mood, technical settings)
4. Relevant hashtags

Make the content authentic and engaging.`;
        const messages = [
            { role: 'system', content: 'You are a professional social media content creator. Generate authentic, engaging content.' },
            { role: 'user', content: basePrompt }
        ];
        // Add image analysis if provided
        if (imageBase64) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: 'Analyze this image and incorporate it into the content:' },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
            });
        }
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            temperature: 0.8,
            max_tokens: 1000
        });
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No content generated from AI service');
        }
        // Parse the AI response (simplified parsing)
        const lines = content.split('\n').filter(line => line.trim());
        // Extract titles (look for numbered list or bullet points)
        const titles = [];
        const titleSection = lines.find(line => line.toLowerCase().includes('title'));
        if (titleSection) {
            const titleIndex = lines.indexOf(titleSection);
            if (titleIndex !== -1) {
                const titleLines = lines.slice(titleIndex + 1, titleIndex + 4);
                titles.push(...titleLines.map(line => line.replace(/^\d+\.?\s*/, '').replace(/^[-*]\s*/, '').trim()));
            }
        }
        // Fallback titles if parsing fails
        if (titles.length === 0) {
            titles.push(`New ${style || 'content'} post ✨`, `Feeling ${style || 'good'} today 💫`, `Latest ${theme || 'lifestyle'} update 🌟`);
        }
        // Use the full AI content
        const postContent = content;
        return {
            titles: titles.slice(0, 3),
            content: postContent,
            photoInstructions: {
                lighting: 'Natural lighting or soft artificial light',
                cameraAngle: 'Eye level for connection',
                composition: 'Rule of thirds composition',
                styling: 'Authentic styling that matches your brand',
                mood: 'Confident and authentic',
                technicalSettings: 'Good focus with balanced exposure'
            },
            hashtags: ['#contentcreator', '#authentic', '#lifestyle'],
            caption: titles[0] || 'New post!',
            provider: 'openai'
        };
    }
    catch (error) {
        console.error('AI generation error:', error);
        // Production error handling - no demo content
        if (error instanceof Error) {
            if (error.message.includes('quota') || error.message.includes('billing')) {
                throw new Error('AI service quota exceeded. Please upgrade your plan or try again later.');
            }
            if (error.message.includes('API key')) {
                throw new Error('AI service configuration error. Please contact support.');
            }
        }
        throw new Error('AI content generation temporarily unavailable. Please try again in a few moments.');
    }
}
// Image analysis for content generation
export async function analyzeImageForContent(imageBase64) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('AI service not configured');
        }
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'Analyze the image and provide a detailed description for content creation.' },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Describe this image in detail for social media content creation:' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                    ]
                }
            ],
            temperature: 0.7,
            max_tokens: 300
        });
        return completion.choices[0]?.message?.content || 'Image analysis unavailable';
    }
    catch (error) {
        console.error('Image analysis error:', error);
        throw new Error('Image analysis temporarily unavailable');
    }
}
// Simple content generation for basic use cases
export async function generateSimpleContent(prompt, platform = 'general') {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('AI service not configured');
        }
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: `Generate content for ${platform} platform.` },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500
        });
        return completion.choices[0]?.message?.content || 'Content generation unavailable';
    }
    catch (error) {
        console.error('Simple content generation error:', error);
        throw new Error('Content generation temporarily unavailable');
    }
}
