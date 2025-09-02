import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Zap, TrendingUp, Target, BarChart3, Clock, Users, Settings, Sparkles, ArrowUp, ArrowDown, CheckCircle, AlertTriangle, Star } from 'lucide-react';
export function ContentOptimizer() {
    const [autoOptimization, setAutoOptimization] = useState(true);
    const [optimizationLevel, setOptimizationLevel] = useState([75]);
    const [realTimeOptimization, setRealTimeOptimization] = useState(true);
    const optimizationInsights = [
        {
            id: 1,
            type: 'title',
            current: 'Good morning selfie 😊',
            optimized: 'Mirror selfie - caught the golden hour perfectly ✨',
            improvement: '+45%',
            metric: 'engagement',
            confidence: 92,
            reason: 'Mirror selfies trending +127%. Adding specific details increases engagement.'
        },
        {
            id: 2,
            type: 'timing',
            current: 'Posted at 2:30 PM',
            optimized: 'Suggested time: 8:45 PM',
            improvement: '+23%',
            metric: 'visibility',
            confidence: 87,
            reason: 'Your audience is 3x more active between 8-10 PM on weekdays.'
        },
        {
            id: 3,
            type: 'hashtags',
            current: '#selfie #me #happy',
            optimized: '#mirrorselfie #goldenhour #aesthetic #selfie',
            improvement: '+38%',
            metric: 'discoverability',
            confidence: 89,
            reason: 'Trending hashtags with higher engagement rates and better reach.'
        },
        {
            id: 4,
            type: 'platform',
            current: 'Reddit only',
            optimized: 'Reddit + Instagram Stories',
            improvement: '+67%',
            metric: 'reach',
            confidence: 78,
            reason: 'Cross-platform posting increases total reach significantly.'
        }
    ];
    const performanceMetrics = [
        {
            metric: 'Engagement Rate',
            current: '3.2%',
            optimized: '4.8%',
            change: '+50%',
            trend: 'up'
        },
        {
            metric: 'Reach',
            current: '12.4K',
            optimized: '18.7K',
            change: '+51%',
            trend: 'up'
        },
        {
            metric: 'Comments',
            current: '89',
            optimized: '134',
            change: '+51%',
            trend: 'up'
        },
        {
            metric: 'Shares',
            current: '23',
            optimized: '41',
            change: '+78%',
            trend: 'up'
        }
    ];
    const abTests = [
        {
            id: 1,
            name: 'Title Optimization',
            status: 'running',
            variantA: 'Original title format',
            variantB: 'AI-optimized titles',
            progress: 67,
            winner: null,
            participants: 89,
            improvement: null
        },
        {
            id: 2,
            name: 'Posting Time',
            status: 'completed',
            variantA: 'User preferred times',
            variantB: 'AI-suggested times',
            progress: 100,
            winner: 'B',
            participants: 156,
            improvement: '+32% engagement'
        },
        {
            id: 3,
            name: 'Hashtag Strategy',
            status: 'completed',
            variantA: 'Manual hashtags',
            variantB: 'Trending hashtags',
            progress: 100,
            winner: 'B',
            participants: 203,
            improvement: '+28% reach'
        },
        {
            id: 4,
            name: 'Photo Filters',
            status: 'pending',
            variantA: 'No filter',
            variantB: 'Warm tone filter',
            progress: 0,
            winner: null,
            participants: 0,
            improvement: null
        }
    ];
    const optimizationRules = [
        {
            id: 1,
            name: 'Peak Time Posting',
            description: 'Automatically adjust posting times based on audience activity',
            enabled: true,
            impact: 'high',
            automations: 234
        },
        {
            id: 2,
            name: 'Trending Hashtag Integration',
            description: 'Include trending hashtags relevant to your content',
            enabled: true,
            impact: 'medium',
            automations: 189
        },
        {
            id: 3,
            name: 'Title Enhancement',
            description: 'AI-powered title optimization for better engagement',
            enabled: true,
            impact: 'high',
            automations: 156
        },
        {
            id: 4,
            name: 'Cross-Platform Adaptation',
            description: 'Adapt content format for optimal performance on each platform',
            enabled: false,
            impact: 'high',
            automations: 0
        }
    ];
    const getImpactColor = (impact) => {
        switch (impact) {
            case 'high': return 'text-green-400';
            case 'medium': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    };
    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
            case 'completed': return 'bg-green-500/20 text-green-400 border-green-500/20';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
        }
    };
    return (<div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Content Optimizer
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered content optimization for maximum engagement and reach
          </p>
        </div>
        <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
          Phase 4 • Optimization
        </Badge>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights" data-testid="tab-insights">AI Insights</TabsTrigger>
          <TabsTrigger value="testing" data-testid="tab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Optimization Rules</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {performanceMetrics.map((metric, index) => (<Card key={index} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-400">{metric.metric}</CardTitle>
                  {metric.trend === 'up' ? (<ArrowUp className="h-4 w-4 text-green-400"/>) : (<ArrowDown className="h-4 w-4 text-red-400"/>)}
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Current:</span>
                      <span className="text-white">{metric.current}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Optimized:</span>
                      <span className="text-purple-400">{metric.optimized}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium text-green-400">{metric.change}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>))}
          </div>

          {/* Optimization Suggestions */}
          <div className="grid gap-4">
            {optimizationInsights.map((insight) => (<Card key={insight.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      {insight.type === 'title' && <Sparkles className="h-5 w-5 text-purple-400"/>}
                      {insight.type === 'timing' && <Clock className="h-5 w-5 text-purple-400"/>}
                      {insight.type === 'hashtags' && <TrendingUp className="h-5 w-5 text-purple-400"/>}
                      {insight.type === 'platform' && <Users className="h-5 w-5 text-purple-400"/>}
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white capitalize">
                        {insight.type} Optimization
                      </CardTitle>
                      <p className="text-sm text-green-400">+{insight.improvement} {insight.metric}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{insight.confidence}%</div>
                    <p className="text-xs text-gray-400">Confidence</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current vs Optimized */}
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Current:</p>
                      <p className="text-white">{insight.current}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <p className="text-xs text-purple-400 mb-1">Optimized:</p>
                      <p className="text-white">{insight.optimized}</p>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">AI Confidence</span>
                      <span className="text-purple-400">{insight.confidence}%</span>
                    </div>
                    <Progress value={insight.confidence} className="h-2"/>
                  </div>

                  {/* Reason and Actions */}
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-gray-400 flex-1 mr-4">{insight.reason}</p>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" data-testid={`save-insight-${insight.id}`}>
                        Save
                      </Button>
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700" data-testid={`apply-insight-${insight.id}`}>
                        <Zap className="h-4 w-4 mr-1"/>
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>))}
          </div>

          <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Star className="h-5 w-5 text-yellow-400"/>
                Pro Tip
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">
                Applying all current optimizations could increase your overall engagement by up to 67%. 
                Start with high-confidence suggestions for best results.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <div className="grid gap-4">
            {abTests.map((test) => (<Card key={test.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg text-white">{test.name}</CardTitle>
                    <p className="text-sm text-gray-400">{test.participants} participants</p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(test.status)}>
                    {test.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Test Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white">{test.progress}%</span>
                    </div>
                    <Progress value={test.progress} className="h-2"/>
                  </div>

                  {/* Variants */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Variant A:</p>
                      <p className="text-white text-sm">{test.variantA}</p>
                      {test.winner === 'A' && (<CheckCircle className="h-4 w-4 text-green-400 mt-2"/>)}
                    </div>
                    <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                      <p className="text-xs text-gray-400 mb-1">Variant B:</p>
                      <p className="text-white text-sm">{test.variantB}</p>
                      {test.winner === 'B' && (<CheckCircle className="h-4 w-4 text-green-400 mt-2"/>)}
                    </div>
                  </div>

                  {/* Results */}
                  <div className="flex items-center justify-between">
                    <div>
                      {test.improvement && (<span className="text-sm text-green-400">{test.improvement}</span>)}
                      {test.status === 'running' && (<span className="text-sm text-gray-400">Test in progress...</span>)}
                      {test.status === 'pending' && (<span className="text-sm text-gray-400">Waiting to start</span>)}
                    </div>
                    <div className="flex space-x-2">
                      {test.status === 'completed' && (<Button variant="outline" size="sm" data-testid={`view-results-${test.id}`}>
                          View Results
                        </Button>)}
                      {test.status === 'running' && (<Button variant="outline" size="sm" data-testid={`stop-test-${test.id}`}>
                          Stop Test
                        </Button>)}
                      {test.status === 'pending' && (<Button size="sm" className="bg-purple-600 hover:bg-purple-700" data-testid={`start-test-${test.id}`}>
                          Start Test
                        </Button>)}
                    </div>
                  </div>
                </CardContent>
              </Card>))}
          </div>

          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Create New A/B Test</CardTitle>
              <p className="text-sm text-gray-400">Test different approaches to optimize your content performance</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="create-ab-test">
                <BarChart3 className="h-4 w-4 mr-2"/>
                Create A/B Test
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-4">
            {optimizationRules.map((rule) => (<Card key={rule.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg text-white">{rule.name}</CardTitle>
                    <p className="text-sm text-gray-400">{rule.description}</p>
                  </div>
                  <Switch checked={rule.enabled} onCheckedChange={() => { }} data-testid={`switch-rule-${rule.id}`}/>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center gap-1">
                        <Target className="h-4 w-4 text-purple-400"/>
                        <span className="text-gray-400">Impact:</span>
                        <span className={`capitalize ${getImpactColor(rule.impact)}`}>
                          {rule.impact}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="h-4 w-4 text-purple-400"/>
                        <span className="text-gray-400">Applied:</span>
                        <span className="text-white">{rule.automations} times</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`configure-rule-${rule.id}`}>
                      Configure
                    </Button>
                  </div>

                  {rule.enabled && (<div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-400"/>
                        <span className="text-sm text-green-400">Active and optimizing your content</span>
                      </div>
                    </div>)}

                  {!rule.enabled && (<div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-gray-400"/>
                        <span className="text-sm text-gray-400">Disabled - missing potential optimizations</span>
                      </div>
                    </div>)}
                </CardContent>
              </Card>))}
          </div>

          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Create Custom Rule</CardTitle>
              <p className="text-sm text-gray-400">Set up custom optimization rules based on your preferences</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="create-custom-rule">
                <Settings className="h-4 w-4 mr-2"/>
                Create Custom Rule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4">
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Optimization Settings</CardTitle>
                <p className="text-sm text-gray-400">Configure how AI optimizes your content</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Auto-optimization</p>
                    <p className="text-sm text-gray-400">Automatically apply high-confidence optimizations</p>
                  </div>
                  <Switch checked={autoOptimization} onCheckedChange={setAutoOptimization} data-testid="switch-auto-optimization"/>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <label className="text-white">Optimization aggressiveness</label>
                    <span className="text-purple-400">{optimizationLevel[0]}%</span>
                  </div>
                  <Slider value={optimizationLevel} onValueChange={setOptimizationLevel} max={100} min={25} step={5} className="w-full" data-testid="slider-optimization-level"/>
                  <p className="text-xs text-gray-500">
                    Higher levels provide more aggressive optimizations but may change your content style more significantly
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Real-time optimization</p>
                    <p className="text-sm text-gray-400">Optimize content during posting process</p>
                  </div>
                  <Switch checked={realTimeOptimization} onCheckedChange={setRealTimeOptimization} data-testid="switch-real-time-optimization"/>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Learning Preferences</CardTitle>
                <p className="text-sm text-gray-400">Help AI learn your style and preferences</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Learn from manual edits</p>
                    <p className="text-sm text-gray-400">Improve suggestions based on your manual changes</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-learn-edits"/>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Track performance feedback</p>
                    <p className="text-sm text-gray-400">Use post performance to refine future optimizations</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-track-performance"/>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Preserve personal style</p>
                    <p className="text-sm text-gray-400">Maintain your unique voice while optimizing</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-preserve-style"/>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>);
}
