/**
 * Subreddit Discovery Page
 * 
 * Features:
 * - QW-7: Post Performance Predictor
 * - QW-8: Smart Subreddit Recommendations
 */

import { useState } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { PerformancePrediction } from '@/components/analytics/PerformancePrediction';
import { SubredditRecommendations } from '@/components/analytics/SubredditRecommendations';

export default function SubredditDiscovery() {
  const { user } = useAuth();
  const [testSubreddit, setTestSubreddit] = useState('');
  const [testTitle, setTestTitle] = useState('');
  const [showPrediction, setShowPrediction] = useState(false);

  const hasAccess = user?.tier && ['pro', 'premium'].includes(user.tier);

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              Subreddit Discovery
            </CardTitle>
            <CardDescription>
              Find the best subreddits for your content
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">Pro Feature</h3>
            <p className="text-gray-600 mb-4">
              Subreddit discovery and performance predictions are available for Pro and Premium tiers
            </p>
            <Button className="mt-6">Upgrade to Pro</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          Subreddit Discovery
        </h1>
        <p className="text-muted-foreground mt-2">
          Find the best subreddits for your content and predict post performance
        </p>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="recommendations">
            <Sparkles className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="predictor">
            <TrendingUp className="h-4 w-4 mr-2" />
            Performance Predictor
          </TabsTrigger>
        </TabsList>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-6">
          <SubredditRecommendations />
        </TabsContent>

        {/* Performance Predictor Tab */}
        <TabsContent value="predictor" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Test Post Performance
              </CardTitle>
              <CardDescription>
                Enter a subreddit and title to predict how your post will perform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subreddit">Subreddit</Label>
                  <Input
                    id="subreddit"
                    placeholder="e.g., gonewild"
                    value={testSubreddit}
                    onChange={(e) => setTestSubreddit(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Post Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter your post title..."
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {testTitle.length} characters
                  </p>
                </div>

                <Button
                  onClick={() => setShowPrediction(true)}
                  disabled={!testSubreddit || !testTitle}
                  className="w-full"
                >
                  Predict Performance
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Show prediction when user clicks button */}
          {showPrediction && testSubreddit && testTitle && (
            <PerformancePrediction
              subreddit={testSubreddit}
              title={testTitle}
              scheduledTime={new Date()}
            />
          )}

          {/* Example predictions */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>
                Our prediction algorithm analyzes multiple factors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Title Quality (15%)</div>
                    <p className="text-sm text-muted-foreground">
                      Optimal length, question marks, emojis, and formatting
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Timing (20%)</div>
                    <p className="text-sm text-muted-foreground">
                      Based on your historical performance at different times
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Subreddit Health (35%)</div>
                    <p className="text-sm text-muted-foreground">
                      Success rate, engagement, and removal rate in this subreddit
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Your Success Rate (30%)</div>
                    <p className="text-sm text-muted-foreground">
                      Your historical performance in this specific subreddit
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
