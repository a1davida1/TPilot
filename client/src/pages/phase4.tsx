import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SocialAutomation } from '@/components/automation/SocialAutomation';
import { TrendIntelligence } from '@/components/intelligence/TrendIntelligence';
import { CommunityManager } from '@/components/community/CommunityManager';
import { ContentOptimizer } from '@/components/optimization/ContentOptimizer';
import { 
  Zap, 
  TrendingUp, 
  Users, 
  Target, 
  BarChart3, 
  Clock, 
  MessageCircle,
  Brain,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Star,
  Activity
} from 'lucide-react';

export default function Phase4Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  const phase4Features = [
    {
      id: 'automation',
      title: 'Social Automation',
      description: 'AI-powered posting at optimal times across platforms',
      icon: Zap,
      status: 'operational',
      stats: { posts: '847', success: '94%', saved: '89h' },
      color: 'from-blue-500 to-purple-500'
    },
    {
      id: 'intelligence',
      title: 'Trend Intelligence',
      description: 'Real-time trend detection and content suggestions',
      icon: Brain,
      status: 'operational',
      stats: { trends: '23', accuracy: '89%', suggestions: '156' },
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'community',
      title: 'Community Manager',
      description: 'Advanced engagement tracking and auto-responses',
      icon: Users,
      status: 'operational',
      stats: { communities: '4', engagement: '94%', responses: '234' },
      color: 'from-pink-500 to-red-500'
    },
    {
      id: 'optimizer',
      title: 'Content Optimizer',
      description: 'AI-powered A/B testing and performance optimization',
      icon: Target,
      status: 'operational',
      stats: { tests: '12', improvement: '+45%', confidence: '92%' },
      color: 'from-green-500 to-blue-500'
    }
  ];

  const quickStats = [
    {
      title: 'Automated Actions',
      value: '2,847',
      change: '+234%',
      icon: Zap,
      color: 'text-blue-400'
    },
    {
      title: 'Time Saved',
      value: '156h',
      change: '+89h',
      icon: Clock,
      color: 'text-purple-400'
    },
    {
      title: 'Engagement Boost',
      value: '+67%',
      change: '+12%',
      icon: TrendingUp,
      color: 'text-green-400'
    },
    {
      title: 'AI Confidence',
      value: '94%',
      change: '+8%',
      icon: Brain,
      color: 'text-pink-400'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'automation',
      action: 'Posted to r/selfie using optimal timing',
      time: '15m ago',
      result: '+23% engagement',
      icon: Zap,
      color: 'text-blue-400'
    },
    {
      id: 2,
      type: 'trend',
      action: 'Detected new trending topic: Mirror selfies',
      time: '1h ago',
      result: '+127% trend score',
      icon: TrendingUp,
      color: 'text-purple-400'
    },
    {
      id: 3,
      type: 'community',
      action: 'Auto-replied to 12 new comments',
      time: '2h ago',
      result: '4.8/5 satisfaction',
      icon: MessageCircle,
      color: 'text-green-400'
    },
    {
      id: 4,
      type: 'optimization',
      action: 'A/B test completed: Title optimization',
      time: '3h ago',
      result: '+32% improvement',
      icon: Target,
      color: 'text-pink-400'
    }
  ];

  const aiInsights = [
    {
      priority: 'high',
      title: 'Mirror Selfie Opportunity',
      description: 'Mirror selfies are trending +127%. Consider posting between 8-10 PM for maximum visibility.',
      action: 'Create Mirror Selfie Content',
      confidence: 94
    },
    {
      priority: 'medium',
      title: 'Posting Schedule Optimization',
      description: 'Your audience is 3x more active between 8-10 PM. Adjust auto-posting schedule.',
      action: 'Update Schedule',
      confidence: 87
    },
    {
      priority: 'low',
      title: 'Cross-Platform Expansion',
      description: 'Instagram Stories could increase your reach by 67%. Consider expanding platform strategy.',
      action: 'Connect Instagram',
      confidence: 78
    }
  ];

  const getIconComponent = (IconComponent: unknown) => IconComponent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Phase 4: Advanced Automation & Intelligence
            </h1>
            <p className="text-gray-400 mt-2">
              Sophisticated AI-powered automation, trend analysis, and community management
            </p>
          </div>
          <Badge variant="secondary" className="bg-green-500/10 text-green-400 border-green-500/20">
            ✓ Operational
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 bg-gray-800/50 border border-gray-700">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="automation" data-testid="tab-automation">Automation</TabsTrigger>
            <TabsTrigger value="intelligence" data-testid="tab-intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="community" data-testid="tab-community">Community</TabsTrigger>
            <TabsTrigger value="optimizer" data-testid="tab-optimizer">Optimizer</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {quickStats.map((stat, index) => {
                const IconComponent = getIconComponent(stat.icon);
                return (
                  <Card key={index} className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-gray-400">{stat.title}</CardTitle>
                      <IconComponent className={`h-5 w-5 ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <p className="text-xs text-green-400">{stat.change} this month</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Feature Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {phase4Features.map((feature) => {
                const IconComponent = getIconComponent(feature.icon);
                return (
                  <Card key={feature.id} className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm overflow-hidden">
                    <div className={`h-1 bg-gradient-to-r ${feature.color}`} />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-lg bg-gradient-to-r ${feature.color} bg-opacity-20`}>
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                          <p className="text-sm text-gray-400">{feature.description}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {feature.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {Object.entries(feature.stats).map(([key, value]) => (
                          <div key={key} className="text-center">
                            <div className="font-semibold text-white">{value}</div>
                            <div className="text-gray-400 capitalize">{key}</div>
                          </div>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full border-gray-600 hover:border-purple-500 hover:bg-purple-500/10"
                        onClick={() => setActiveTab(feature.id)}
                        data-testid={`open-${feature.id}`}
                      >
                        Open {feature.title}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* AI Insights */}
            <Card className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Sparkles className="h-5 w-5 text-yellow-400" />
                  AI Insights & Recommendations
                </CardTitle>
                <p className="text-sm text-gray-400">Intelligent recommendations based on current trends and performance</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiInsights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-800/30 border border-gray-700/50">
                    <div className={`p-2 rounded-lg ${
                      insight.priority === 'high' ? 'bg-red-500/20 border border-red-500/30' :
                      insight.priority === 'medium' ? 'bg-yellow-500/20 border border-yellow-500/30' :
                      'bg-blue-500/20 border border-blue-500/30'
                    }`}>
                      <Star className={`h-4 w-4 ${
                        insight.priority === 'high' ? 'text-red-400' :
                        insight.priority === 'medium' ? 'text-yellow-400' :
                        'text-blue-400'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{insight.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">{insight.description}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">Confidence:</span>
                          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                            {insight.confidence}%
                          </Badge>
                        </div>
                        <Button size="sm" variant="outline" className="border-gray-600 hover:border-purple-500">
                          {insight.action}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Activity className="h-5 w-5 text-purple-400" />
                  Recent AI Activity
                </CardTitle>
                <p className="text-sm text-gray-400">Latest automated actions and their results</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.map((activity) => {
                  const IconComponent = getIconComponent(activity.icon);
                  return (
                    <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-800/20 border border-gray-700/30">
                      <div className="p-2 rounded-lg bg-gray-700/50">
                        <IconComponent className={`h-4 w-4 ${activity.color}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm">{activity.action}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">{activity.time}</span>
                          <span className="text-xs text-green-400">{activity.result}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation">
            <SocialAutomation />
          </TabsContent>

          <TabsContent value="intelligence">
            <TrendIntelligence />
          </TabsContent>

          <TabsContent value="community">
            <CommunityManager />
          </TabsContent>

          <TabsContent value="optimizer">
            <ContentOptimizer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}