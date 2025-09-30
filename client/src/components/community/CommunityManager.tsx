import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  MessageCircle, 
  Heart, 
  Reply, 
  TrendingUp, 
  Shield, 
  CheckCircle,
  Search,
  Filter,
  Bell,
  Star
} from 'lucide-react';

export function CommunityManager() {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  // TODO: Implement engagement tracking feature
  // const [engagementTracking, setEngagementTracking] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const communities = [
    {
      id: 1,
      name: 'r/selfie',
      members: '847K',
      activity: 'very_high',
      engagement: 4.2,
      posts: 23,
      lastPost: '2h ago',
      status: 'active',
      rules: 'verified',
      avgLikes: 156,
      avgComments: 23,
      bestTimes: ['8PM-10PM', '11AM-1PM']
    },
    {
      id: 2,
      name: 'r/FreeCompliments',
      members: '623K',
      activity: 'high',
      engagement: 3.8,
      posts: 18,
      lastPost: '4h ago',
      status: 'active',
      rules: 'verified',
      avgLikes: 134,
      avgComments: 31,
      bestTimes: ['7PM-9PM', '12PM-2PM']
    },
    {
      id: 3,
      name: 'r/amihot',
      members: '412K',
      activity: 'medium',
      engagement: 3.1,
      posts: 12,
      lastPost: '1d ago',
      status: 'monitoring',
      rules: 'pending',
      avgLikes: 89,
      avgComments: 18,
      bestTimes: ['9PM-11PM', '1PM-3PM']
    },
    {
      id: 4,
      name: 'r/Rateme',
      members: '298K',
      activity: 'low',
      engagement: 2.3,
      posts: 8,
      lastPost: '2d ago',
      status: 'inactive',
      rules: 'needs_review',
      avgLikes: 45,
      avgComments: 12,
      bestTimes: ['8PM-10PM', '2PM-4PM']
    }
  ];

  const engagements = [
    {
      id: 1,
      type: 'comment',
      user: 'u/photographer_fan',
      content: 'Amazing lighting in this shot! How did you achieve this effect?',
      post: 'Mirror selfie - Golden hour vibes',
      time: '15m ago',
      sentiment: 'positive',
      replied: false,
      priority: 'high'
    },
    {
      id: 2,
      type: 'dm',
      user: 'u/art_lover_99',
      content: 'Love your aesthetic! Would you be interested in collaborating?',
      post: null,
      time: '1h ago',
      sentiment: 'positive',
      replied: false,
      priority: 'medium'
    },
    {
      id: 3,
      type: 'comment',
      user: 'u/creative_soul',
      content: 'Your posts always brighten my day! Keep being amazing 💕',
      post: 'Cozy morning coffee setup',
      time: '2h ago',
      sentiment: 'positive',
      replied: true,
      priority: 'low'
    },
    {
      id: 4,
      type: 'mention',
      user: 'u/style_guru',
      content: 'Check out @yourusername for outfit inspiration!',
      post: null,
      time: '3h ago',
      sentiment: 'positive',
      replied: false,
      priority: 'medium'
    }
  ];

  const autoReplyTemplates = [
    {
      id: 1,
      trigger: 'compliment',
      template: 'Thank you so much! Your kind words mean a lot to me 💕',
      usage: 89,
      enabled: true
    },
    {
      id: 2,
      trigger: 'question_lighting',
      template: 'Great question! I used natural window light with a white reflector. The key is timing - golden hour works best!',
      usage: 67,
      enabled: true
    },
    {
      id: 3,
      trigger: 'collaboration',
      template: "Thanks for reaching out! I'd love to hear more about your collaboration idea. Feel free to send me a DM with details!",
      usage: 34,
      enabled: true
    },
    {
      id: 4,
      trigger: 'outfit_question',
      template: 'Thanks for asking! This outfit is from [brand]. I love mixing comfortable pieces with feminine touches!',
      usage: 23,
      enabled: false
    }
  ];

  const getActivityColor = (activity: string) => {
    switch (activity) {
      case 'very_high': return 'text-green-400';
      case 'high': return 'text-yellow-400';
      case 'medium': return 'text-orange-400';
      default: return 'text-red-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/20';
      case 'monitoring': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      default: return 'bg-red-500/20 text-red-400 border-red-500/20';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400';
      case 'neutral': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/20';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Community Manager
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage your communities and automate engagement across platforms
          </p>
        </div>
        <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
          Phase 4 • Community
        </Badge>
      </div>

      <Tabs defaultValue="communities" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="communities" data-testid="tab-communities">Communities</TabsTrigger>
          <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
          <TabsTrigger value="auto-reply" data-testid="tab-auto-reply">Auto Reply</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="communities" className="space-y-4">
          {/* Community Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Active Communities</CardTitle>
                <Users className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">4</div>
                <p className="text-xs text-green-400">2 highly active</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Posts</CardTitle>
                <MessageCircle className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">61</div>
                <p className="text-xs text-green-400">+12 this week</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Avg Engagement</CardTitle>
                <Heart className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">3.4%</div>
                <p className="text-xs text-green-400">+0.2% vs last month</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Reach</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">2.1M</div>
                <p className="text-xs text-green-400">Total community reach</p>
              </CardContent>
            </Card>
          </div>

          {/* Communities List */}
          <div className="grid gap-4">
            {communities.map((community) => (
              <Card key={community.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Users className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">{community.name}</CardTitle>
                      <p className="text-sm text-gray-400">{community.members} members</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={getStatusColor(community.status)}>
                      {community.status}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`border-gray-600 ${getActivityColor(community.activity)}`}
                    >
                      {community.activity.replace('_', ' ')} activity
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Engagement Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400">Posts</div>
                      <div className="font-semibold text-white">{community.posts}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Engagement</div>
                      <div className="font-semibold text-white">{community.engagement}%</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Avg Likes</div>
                      <div className="font-semibold text-white">{community.avgLikes}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Last Post</div>
                      <div className="font-semibold text-white">{community.lastPost}</div>
                    </div>
                  </div>

                  {/* Best Times */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Best posting times:</p>
                    <div className="flex space-x-2">
                      {community.bestTimes.map((time, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-purple-500/20 text-purple-300">
                          {time}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Rules Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-purple-400" />
                      <span className="text-sm text-gray-400">Rules compliance:</span>
                      <Badge
                        variant="outline"
                        className={
                          community.rules === 'verified' ? 'border-green-500 text-green-400' :
                          community.rules === 'pending' ? 'border-yellow-500 text-yellow-400' :
                          'border-red-500 text-red-400'
                        }
                      >
                        {community.rules.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`manage-${community.name.slice(2)}`}>
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          {/* Engagement Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  className="pl-10 bg-gray-900/50 border-gray-700"
                  data-testid="search-engagements"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                {['all', 'comments', 'dms', 'mentions'].map((filter) => (
                  <Badge
                    key={filter}
                    variant={selectedFilter === filter ? 'default' : 'outline'}
                    className={`cursor-pointer capitalize ${
                      selectedFilter === filter 
                        ? 'bg-purple-500 hover:bg-purple-600' 
                        : 'border-gray-600 hover:border-purple-500'
                    }`}
                    onClick={() => setSelectedFilter(filter)}
                    data-testid={`filter-${filter}`}
                  >
                    {filter}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-400">4 unread</span>
            </div>
          </div>

          {/* Engagement List */}
          <div className="grid gap-4">
            {engagements.map((engagement) => (
              <Card key={engagement.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      {engagement.type === 'comment' && <MessageCircle className="h-4 w-4 text-purple-400" />}
                      {engagement.type === 'dm' && <Reply className="h-4 w-4 text-purple-400" />}
                      {engagement.type === 'mention' && <Bell className="h-4 w-4 text-purple-400" />}
                    </div>
                    <div>
                      <CardTitle className="text-base text-white">{engagement.user}</CardTitle>
                      <p className="text-sm text-gray-400">
                        {engagement.post ? `on "${engagement.post}"` : 'Direct message'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={getPriorityColor(engagement.priority)}>
                      {engagement.priority}
                    </Badge>
                    <span className="text-xs text-gray-500">{engagement.time}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-gray-300">{engagement.content}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Heart className={`h-4 w-4 ${getSentimentColor(engagement.sentiment)}`} />
                        <span className={`text-sm capitalize ${getSentimentColor(engagement.sentiment)}`}>
                          {engagement.sentiment}
                        </span>
                      </div>
                      {engagement.replied && (
                        <div className="flex items-center space-x-1">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-green-400">Replied</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {!engagement.replied && (
                        <>
                          <Button variant="outline" size="sm" data-testid={`auto-reply-${engagement.id}`}>
                            Auto Reply
                          </Button>
                          <Button size="sm" className="bg-purple-600 hover:bg-purple-700" data-testid={`reply-${engagement.id}`}>
                            Reply
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" data-testid={`view-${engagement.id}`}>
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auto-reply" className="space-y-4">
          {/* Auto Reply Settings */}
          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-white">Auto Reply Settings</CardTitle>
                <p className="text-sm text-gray-400">Automatically respond to common engagement types</p>
              </div>
              <Switch
                checked={autoReplyEnabled}
                onCheckedChange={setAutoReplyEnabled}
                data-testid="switch-auto-reply"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Replies Sent</div>
                  <div className="text-2xl font-bold text-white">89</div>
                  <div className="text-xs text-green-400">This month</div>
                </div>
                <div>
                  <div className="text-gray-400">Response Rate</div>
                  <div className="text-2xl font-bold text-white">94%</div>
                  <div className="text-xs text-green-400">Within 15 min</div>
                </div>
                <div>
                  <div className="text-gray-400">Satisfaction</div>
                  <div className="text-2xl font-bold text-white">4.8/5</div>
                  <div className="text-xs text-green-400">User feedback</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reply Templates */}
          <div className="grid gap-4">
            {autoReplyTemplates.map((template) => (
              <Card key={template.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base text-white capitalize">
                      {template.trigger.replace('_', ' ')} Response
                    </CardTitle>
                    <p className="text-sm text-gray-400">Used {template.usage} times</p>
                  </div>
                  <Switch
                    checked={template.enabled}
                    onCheckedChange={() => {}}
                    data-testid={`switch-template-${template.id}`}
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p className="text-gray-300 text-sm">{template.template}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Star className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm text-gray-400">Performance: High</span>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`edit-template-${template.id}`}>
                      Edit Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Create New Template</CardTitle>
              <p className="text-sm text-gray-400">Add a new auto-reply template for specific triggers</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Trigger Keywords</label>
                <Input
                  className="bg-gray-900/50 border-gray-700"
                  data-testid="input-trigger-keywords"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Reply Template</label>
                <Textarea
                  className="bg-gray-900/50 border-gray-700 min-h-[100px]"
                  data-testid="textarea-reply-template"
                />
              </div>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="create-template">
                Create Template
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Engagement Trends</CardTitle>
                <p className="text-sm text-gray-400">Last 30 days</p>
              </CardHeader>
              <CardContent>
                <div className="h-64 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Total Engagements</span>
                      <span className="text-2xl font-bold text-white">2,847</span>
                    </div>
                    <Progress value={68} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Response Rate</span>
                      <span className="text-2xl font-bold text-white">94%</span>
                    </div>
                    <Progress value={94} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Avg. Response Time</span>
                      <span className="text-2xl font-bold text-white">2.3 min</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  <div className="pt-4 border-t border-gray-700">
                    <p className="text-xs text-gray-500">Data refreshes every hour</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Response Performance</CardTitle>
                <p className="text-sm text-gray-400">Auto-reply effectiveness</p>
              </CardHeader>
              <CardContent>
                <div className="h-64 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Auto-replies sent</p>
                      <p className="text-xl font-bold text-white">423</p>
                      <p className="text-xs text-green-400">+12% this week</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Click-through rate</p>
                      <p className="text-xl font-bold text-white">31%</p>
                      <p className="text-xs text-green-400">+5% this week</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Top performing templates</p>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white">Welcome message</span>
                        <Badge className="bg-green-600/20 text-green-400">87% CTR</Badge>
                      </div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-white">Profile link</span>
                        <Badge className="bg-blue-600/20 text-blue-400">72% CTR</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4">
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Notification Settings</CardTitle>
                <p className="text-sm text-gray-400">Configure how you receive community notifications</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">High priority engagements</p>
                    <p className="text-sm text-gray-400">Instant notifications for important interactions</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-high-priority" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Daily community summary</p>
                    <p className="text-sm text-gray-400">Daily digest of community activity</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-daily-summary" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Auto-reply confirmations</p>
                    <p className="text-sm text-gray-400">Notifications when auto-replies are sent</p>
                  </div>
                  <Switch data-testid="switch-auto-reply-confirmations" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Moderation Settings</CardTitle>
                <p className="text-sm text-gray-400">Configure automatic moderation and safety features</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Spam detection</p>
                    <p className="text-sm text-gray-400">Automatically flag potential spam messages</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-spam-detection" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Sentiment analysis</p>
                    <p className="text-sm text-gray-400">Analyze sentiment of incoming messages</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-sentiment-analysis" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white">Block negative users</p>
                    <p className="text-sm text-gray-400">Automatically block users with negative sentiment</p>
                  </div>
                  <Switch data-testid="switch-block-negative" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}