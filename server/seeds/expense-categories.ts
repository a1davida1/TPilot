import { storage } from "../storage";

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
export async function seedExpenseCategories() {
  try {
    logger.error(...formatLogArgs('🌱 Seeding expense categories...'));

    const categories = [
      {
        name: 'Beauty & Wellness',
        description: 'Professional beauty treatments, skincare, wellness services',
        legalExplanation: 'Beauty and wellness expenses are 100% deductible for content creators as they directly relate to maintaining your professional appearance and brand image.',
        examples: ['Professional makeup', 'Skincare treatments', 'Hair styling', 'Nail services', 'Spa treatments', 'Fitness training'],
        icon: 'sparkles',
        color: '#FF2D92',
        deductionPercentage: 100,
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'Wardrobe & Fashion',
        description: 'Clothing, accessories, and fashion items for content',
        legalExplanation: 'Clothing and accessories purchased specifically for content creation are fully deductible business expenses.',
        examples: ['Lingerie & outfits', 'Shoes & accessories', 'Costumes', 'Jewelry', 'Designer pieces', 'Seasonal wardrobe'],
        icon: 'receipt',
        color: '#AF52DE',
        deductionPercentage: 100,
        isActive: true,
        sortOrder: 2
      },
      {
        name: 'Technology & Equipment',
        description: 'Cameras, lighting, computers, and tech gear',
        legalExplanation: 'All technology and equipment used for content creation and business operations are fully deductible.',
        examples: ['Cameras & lenses', 'Lighting equipment', 'Computers & tablets', 'Editing software', 'Storage devices', 'Audio equipment'],
        icon: 'calculator',
        color: '#007AFF',
        deductionPercentage: 100,
        isActive: true,
        sortOrder: 3
      },
      {
        name: 'Travel & Entertainment',
        description: 'Business travel, events, and entertainment expenses',
        legalExplanation: 'Travel for business purposes, including content creation trips and industry events, is fully deductible.',
        examples: ['Business travel', 'Hotel stays', 'Convention tickets', 'Networking events', 'Content creation trips', 'Transportation'],
        icon: 'trending-up',
        color: '#5AC8FA',
        deductionPercentage: 100,
        isActive: true,
        sortOrder: 4
      },
      {
        name: 'Home Office & Utilities',
        description: 'Home office expenses, internet, phone, utilities',
        legalExplanation: 'Home office expenses including utilities, internet, and phone bills are deductible based on business use percentage.',
        examples: ['Internet & phone', 'Utilities (portion)', 'Home office furniture', 'Decorations & props', 'Office supplies', 'Storage solutions'],
        icon: 'file-text',
        color: '#34C759',
        deductionPercentage: 100,
        isActive: true,
        sortOrder: 5
      },
      {
        name: 'Marketing & Promotion',
        description: 'Advertising, promotions, and marketing expenses',
        legalExplanation: 'All marketing and promotional expenses to grow your business are fully deductible.',
        examples: ['Social media ads', 'Website costs', 'Professional photography', 'Graphic design', 'Business cards', 'Promotional materials'],
        icon: 'dollar-sign',
        color: '#FF9500',
        deductionPercentage: 100,
        isActive: true,
        sortOrder: 6
      }
    ];

    for (const category of categories) {
      try {
        await storage.createExpenseCategory(category);
        logger.error(...formatLogArgs(`✅ Created category: ${category.name}`));
      } catch (_error) {
        // Category might already exist, that's okay
        logger.error(...formatLogArgs(`ℹ️ Category ${category.name} might already exist`));
      }
    }

    logger.error(...formatLogArgs('✅ Expense categories seeded successfully'));
  } catch (error) {
    logger.error(...formatLogArgs('❌ Error seeding expense categories:', error));
  }
}

export async function seedTaxDeductionInfo() {
  try {
    logger.error(...formatLogArgs('🌱 Seeding tax deduction information...'));

    const taxInfo = [
      {
        category: 'Beauty & Wellness',
        title: 'Professional Beauty Treatments',
        description: 'Beauty and wellness expenses are 100% deductible for content creators as they directly relate to maintaining your professional appearance and brand image.',
        legalBasis: 'IRS Publication 535 - Business Expenses for professional appearance costs',
        deductionPercentage: 100,
        examples: ['Professional makeup', 'Skincare treatments', 'Hair styling', 'Nail services', 'Spa treatments', 'Fitness training'],
        documentation: 'Keep receipts and document business purpose for each treatment'
      },
      {
        category: 'Wardrobe & Fashion',
        title: 'Content Creation Wardrobe',
        description: 'Clothing and accessories purchased specifically for content creation are fully deductible business expenses.',
        legalBasis: 'IRS Code Section 162 - Ordinary and necessary business expenses',
        deductionPercentage: 100,
        examples: ['Lingerie & outfits', 'Shoes & accessories', 'Costumes', 'Jewelry', 'Designer pieces', 'Seasonal wardrobe'],
        documentation: 'Document business use and keep purchase receipts'
      },
      {
        category: 'Technology & Equipment',
        title: 'Content Creation Equipment',
        description: 'All technology and equipment used for content creation and business operations are fully deductible.',
        legalBasis: 'IRS Section 179 - Equipment and technology deductions',
        deductionPercentage: 100,
        examples: ['Cameras & lenses', 'Lighting equipment', 'Computers & tablets', 'Editing software', 'Storage devices', 'Audio equipment'],
        documentation: 'Keep receipts and consider depreciation for expensive items'
      },
      {
        category: 'Travel & Entertainment',
        title: 'Business Travel Expenses',
        description: 'Travel for business purposes, including content creation trips and industry events, is fully deductible.',
        legalBasis: 'IRS Publication 463 - Travel, Entertainment, Gift, and Car Expenses',
        deductionPercentage: 100,
        examples: ['Business travel', 'Hotel stays', 'Convention tickets', 'Networking events', 'Content creation trips', 'Transportation'],
        documentation: 'Document business purpose, dates, and keep all travel receipts'
      },
      {
        category: 'Home Office & Utilities',
        title: 'Home Office Deductions',
        description: 'Home office expenses including utilities, internet, and phone bills are deductible based on business use percentage.',
        legalBasis: 'IRS Publication 587 - Business Use of Your Home',
        deductionPercentage: 100,
        examples: ['Internet & phone', 'Utilities (portion)', 'Home office furniture', 'Decorations & props', 'Office supplies', 'Storage solutions'],
        documentation: 'Calculate business use percentage and keep utility bills'
      },
      {
        category: 'Marketing & Promotion',
        title: 'Business Marketing Expenses',
        description: 'All marketing and promotional expenses to grow your business are fully deductible.',
        legalBasis: 'IRS Code Section 162 - Advertising and promotional expenses',
        deductionPercentage: 100,
        examples: ['Social media ads', 'Website costs', 'Professional photography', 'Graphic design', 'Business cards', 'Promotional materials'],
        documentation: 'Keep receipts and document marketing campaign purposes'
      }
    ];

    for (const info of taxInfo) {
      try {
        await storage.createTaxDeductionInfo({
          category: info.category,
          title: info.title,
          description: info.description,
          legalBasis: info.legalBasis,
          examples: info.examples,
          requirements: [info.documentation],
          applicableFor: ['content creators', 'influencers', 'social media creators']
        });
        logger.error(...formatLogArgs(`✅ Created tax info: ${info.title}`));
      } catch (_error) {
        logger.error(...formatLogArgs(`ℹ️ Tax info ${info.title} might already exist`));
      }
    }

    logger.error(...formatLogArgs('✅ Tax deduction information seeded successfully'));
  } catch (error) {
    logger.error(...formatLogArgs('❌ Error seeding tax deduction info:', error));
  }
}

export async function seedTaxData() {
  await seedExpenseCategories();
  await seedTaxDeductionInfo();
}