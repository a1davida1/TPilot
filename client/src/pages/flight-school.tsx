import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  TrendingUp,
  Clock,
  Shield,
  Heart,
  DollarSign,
  Star,
  Lightbulb,
  GraduationCap,
  Zap
} from 'lucide-react';

export default function FlightSchoolPage() {
  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started Here',
      icon: GraduationCap,
      content: `Welcome to ThottoPilot Flight School! Whether you're new to content creation or looking to optimize your workflow, this guide will help you navigate the platform and build a sustainable content business. Start by exploring our dashboard and familiarizing yourself with the core features. Remember, consistency beats perfection - focus on creating value for your audience above all else.`
    },
    {
      id: 'promote',
      title: 'How to Promote',
      icon: TrendingUp,
      content: `Effective promotion is about building genuine connections, not just chasing numbers. Start with your existing networks and expand organically. Use platform analytics to understand what resonates with your audience. Cross-promotion across different communities can help you grow strategically. Remember, quality content that serves your community's needs will always outperform aggressive marketing tactics.`
    },
    {
      id: 'time-management',
      title: 'How to Use Your Time Effectively',
      icon: Clock,
      content: `Time management in content creation requires balancing creativity with efficiency. Batch your content creation sessions, use scheduling tools to maintain consistent posting, and set realistic goals. Focus on high-impact activities that drive results rather than getting caught in perfectionist loops. Regular breaks and self-care are essential to avoid burnout in this demanding field.`
    },
    {
      id: 'stay-safe',
      title: 'How to Stay Safe',
      icon: Shield,
      content: `Safety should be your top priority in content creation. Use platform privacy settings wisely, be cautious about sharing personal information, and maintain professional boundaries with your audience. Consider using content protection tools and watermarks. Regular security audits and staying informed about platform changes will help you navigate this space safely.`
    },
    {
      id: 'stay-sane',
      title: 'How to Stay Sane',
      icon: Heart,
      content: `Mental health is crucial in content creation. Set boundaries between your work and personal life, practice self-care rituals, and don't let metrics define your worth. Build a support network of fellow creators, take regular breaks, and remember that it's okay to step back when needed. Sustainable success comes from enjoying the process, not just the results.`
    },
    {
      id: 'taxes',
      title: 'How to Not Get Swatted (Paying Dem Taxes)...and Why It\'s Not as Bad as You Think',
      icon: DollarSign,
      content: `Tax compliance is non-negotiable in professional content creation. Keep detailed records of all income and expenses from day one. Consider working with a tax professional familiar with creator economy regulations. While taxes may seem daunting, proper planning can actually save you money through deductions and credits. Think of it as investing in your business's future rather than a burden.`
    },
    {
      id: 'needs',
      title: 'What Do You "NEED" to Have',
      icon: Star,
      content: `Essential tools for content creation include reliable recording equipment, a dedicated workspace, and basic editing software. Quality lighting and audio setup are crucial for professional results. A consistent posting schedule and engagement strategy are more important than expensive gear. Start with what you have and upgrade as your income grows.`
    },
    {
      id: 'nice-to-have',
      title: 'What Would Be Nice to Have',
      icon: Lightbulb,
      content: `Advanced equipment like professional cameras, studio lighting, and premium software can enhance your production quality. Professional editing services or VA support can help scale your operation. Marketing tools and analytics platforms provide valuable insights. Consider these investments once your core business is stable and profitable.`
    },
    {
      id: 'teasers',
      title: 'How to Make Teasers (and Why They Are Usually the Right Move)',
      icon: Zap,
      content: `Teasers are powerful engagement tools that build anticipation and drive traffic. They should hint at value without giving everything away, creating curiosity that motivates action. Well-crafted teasers convert better than direct sales approaches because they respect your audience's time while demonstrating your expertise. Focus on solving problems and delivering value rather than hard selling.`
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-primary-50/60 to-primary-100/40 dark:from-background dark:via-primary-900/40 dark:to-primary-950/40">
      {/* Animated Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-[hsl(var(--accent-yellow)/0.12)] opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-pink)/0.12),transparent_55%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent-yellow)/0.08),transparent_55%)]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-10">
        {/* Header */}
        <header className="mb-12 space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-4 py-2 text-primary-600 dark:text-primary-300">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide uppercase">Flight School</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 dark:from-primary-400 dark:via-accent-rose dark:to-primary-500 bg-clip-text text-transparent">
            ThottoPilot Flight School
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-muted-foreground">
            Your comprehensive guide to building a successful content creation business.
            From getting started to scaling your operation, we've got you covered with
            practical advice, best practices, and insider tips.
          </p>
          <Badge className="bg-gradient-to-r from-primary-500 to-accent-rose text-white text-sm px-4 py-2">
            Updated Regularly • Creator-Focused
          </Badge>
        </header>

        {/* Guide Sections */}
        <div className="space-y-8">
          {sections.map((section) => {
            const IconComponent = section.icon;
            return (
              <Card key={section.id} className="group hover:shadow-lg transition-all duration-300 border-primary-100/50 dark:border-primary-900/30">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-3 text-xl sm:text-2xl">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 group-hover:bg-primary-500/20 transition-colors">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-muted-foreground leading-relaxed text-base sm:text-lg">
                    {section.content}
                  </p>
                  {/* Placeholder for affiliate links */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground italic">
                      Recommended tools and resources will be linked here to help you implement these strategies.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer Call to Action */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-primary-500/5 to-accent-rose/5 border-primary-200/50 dark:border-primary-800/50">
            <CardContent className="p-8">
              <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary-600 to-accent-rose bg-clip-text text-transparent">
                Ready to Take Flight?
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                These guides are just the beginning. Join our community of successful creators
                and get access to exclusive resources, live training sessions, and personalized mentorship.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Badge variant="outline" className="px-4 py-2 text-sm">
                  More Guides Coming Soon
                </Badge>
                <Badge variant="outline" className="px-4 py-2 text-sm">
                  Community Support Available
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
