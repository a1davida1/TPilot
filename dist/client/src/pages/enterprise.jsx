import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, Calendar, Image, CreditCard } from 'lucide-react';
import MediaLibrary from '@/components/enterprise/MediaLibrary';
import PostScheduler from '@/components/enterprise/PostScheduler';
import BillingDashboard from '@/components/enterprise/BillingDashboard';
import AIContentStudio from '@/components/enterprise/AIContentStudio';
export default function EnterprisePage() {
    const [activeTab, setActiveTab] = useState('ai-studio');
    return (<div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Crown className="h-8 w-8 text-yellow-500"/>
            <h1 className="text-3xl font-bold">Enterprise Dashboard</h1>
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              Phase 2 - Live
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Advanced AI content creation, media management, and post automation
          </p>
        </div>

        {/* Enterprise Features Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-4">
            <TabsTrigger value="ai-studio" className="flex items-center gap-2" data-testid="tab-ai-studio">
              <Sparkles className="h-4 w-4"/>
              <span className="hidden sm:inline">AI Studio</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center gap-2" data-testid="tab-media">
              <Image className="h-4 w-4"/>
              <span className="hidden sm:inline">Media</span>
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="flex items-center gap-2" data-testid="tab-scheduler">
              <Calendar className="h-4 w-4"/>
              <span className="hidden sm:inline">Scheduler</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2" data-testid="tab-billing">
              <CreditCard className="h-4 w-4"/>
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-studio" className="space-y-6">
            <AIContentStudio />
          </TabsContent>

          <TabsContent value="media" className="space-y-6">
            <MediaLibrary />
          </TabsContent>

          <TabsContent value="scheduler" className="space-y-6">
            <PostScheduler />
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <BillingDashboard />
          </TabsContent>
        </Tabs>

        {/* Quick Stats Footer */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">✓</div>
                <div className="text-sm font-medium">AI Engine</div>
                <div className="text-xs text-muted-foreground">Gemini + OpenAI</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">✓</div>
                <div className="text-sm font-medium">Queue System</div>
                <div className="text-xs text-muted-foreground">Redis + BullMQ</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-500">✓</div>
                <div className="text-sm font-medium">Media Storage</div>
                <div className="text-xs text-muted-foreground">S3 + Watermarking</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">✓</div>
                <div className="text-sm font-medium">Billing</div>
                <div className="text-xs text-muted-foreground">CCBill Integration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);
}
