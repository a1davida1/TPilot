import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Settings, 
  Shield,
  Activity,
  Database,
  CreditCard,
  Eye,
  BarChart3,
  AlertCircle,
  CheckCircle,
  XCircle,
  Target,
  Smartphone,
  Calendar,
  VideoIcon,
  MessageSquare,
  Globe,
  Zap,
  Gift,
  Headphones,
  MonitorPlay,
  FileCheck
} from 'lucide-react';

export function AdminDashboard() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  // Fetch admin stats
  const { data: stats } = useQuery({
    queryKey: ['/api/admin/stats', selectedPeriod],
  });

  // Fetch user data
  const { data: users } = useQuery({
    queryKey: ['/api/admin/users'],
  });

  // Fetch provider costs
  const { data: providers } = useQuery({
    queryKey: ['/api/providers'],
  });

  // Fetch system health
  const { data: systemHealth } = useQuery({
    queryKey: ['/api/admin/system-health'],
  });

  // Fetch visitor analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/admin/analytics', selectedPeriod],
  });

  // Fetch system completeness
  const { data: completeness } = useQuery({
    queryKey: ['/api/admin/completeness'],
  });

  const adminStats = [
    { 
      label: 'Total Users', 
      value: (stats as any)?.totalUsers || 0, 
      change: '+12%',
      icon: <Users className="h-4 w-4" />,
      color: 'text-blue-500'
    },
    { 
      label: 'Revenue', 
      value: `$${(stats as any)?.revenue || '0'}`, 
      change: '+23%',
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-green-500'
    },
    { 
      label: 'Active Users (30d)', 
      value: (stats as any)?.activeUsers || 0, 
      change: '+5%',
      icon: <Activity className="h-4 w-4" />,
      color: 'text-purple-500'
    },
    { 
      label: 'Content Generated', 
      value: (stats as any)?.contentGenerated || 0, 
      change: '+34%',
      icon: <BarChart3 className="h-4 w-4" />,
      color: 'text-pink-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Admin Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Admin Portal
            </h1>
            <p className="text-gray-400 mt-1">System overview and management</p>
          </div>
          <Badge variant="outline" className="text-red-400 border-red-400">
            <Shield className="h-3 w-3 mr-1" />
            Admin Access
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {adminStats.map((stat, index) => (
          <Card key={index} className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className={`${stat.color}`}>{stat.icon}</span>
                <Badge variant="secondary" className="text-xs">
                  {stat.change}
                </Badge>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-gray-400">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-gray-900/50 border-white/10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Visitor Analytics</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="providers">Service Providers</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="roadmap">Development Roadmap</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* User Activity Chart */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>Daily active users over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Activity chart will be implemented with real data
                </div>
              </CardContent>
            </Card>

            {/* Content Generation Stats */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Content Generation</CardTitle>
                <CardDescription>AI content created per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Generation chart will be implemented with real data
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage platform users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4">User</th>
                      <th className="text-left p-4">Tier</th>
                      <th className="text-left p-4">Joined</th>
                      <th className="text-left p-4">Content Created</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users as any)?.slice(0, 5).map((user: any) => (
                      <tr key={user.id} className="border-b border-white/5">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.tier === 'premium' ? 'default' : 'secondary'}>
                            {user.tier}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">{user.contentCount || 0}</td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-green-400 border-green-400">
                            Active
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Button size="sm" variant="ghost">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>Provider Costs & Status</CardTitle>
              <CardDescription>Monitor service usage and costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(providers as any)?.map((provider: any) => (
                  <div key={provider.name} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${provider.available ? 'bg-green-500' : 'bg-red-500'}`} />
                        <h3 className="font-medium">{provider.name}</h3>
                      </div>
                      <Badge variant={provider.available ? 'default' : 'destructive'}>
                        {provider.available ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Input Cost</p>
                        <p className="font-medium">${provider.inputCost}/1M tokens</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Output Cost</p>
                        <p className="font-medium">${provider.outputCost}/1M tokens</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Savings vs GPT-4</p>
                        <p className="font-medium text-green-400">{provider.savings}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${(stats as any)?.monthlyRevenue || '0'}</p>
                <p className="text-sm text-gray-400 mt-2">From subscriptions</p>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Free</span>
                    <span>{(stats as any)?.subscriptions?.free || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pro</span>
                    <span>{(stats as any)?.subscriptions?.pro || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Premium</span>
                    <span>{(stats as any)?.subscriptions?.premium || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Service Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${(stats as any)?.apiCosts || '0'}</p>
                <p className="text-sm text-gray-400 mt-2">This month</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Monitor system status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-blue-400" />
                    <span>Database</span>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Healthy
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-purple-400" />
                    <span>Object Storage</span>
                  </div>
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Configured
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-green-400" />
                    <span>Content Services</span>
                  </div>
                  <Badge variant="outline" className="text-green-400 border-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Operational
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visitor Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{(analytics as any)?.uniqueVisitors || 0}</p>
                    <p className="text-sm text-gray-400">Unique Visitors</p>
                  </div>
                  <Eye className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{(analytics as any)?.pageViews || 0}</p>
                    <p className="text-sm text-gray-400">Page Views</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{(analytics as any)?.bounceRate?.toFixed(1) || 0}%</p>
                    <p className="text-sm text-gray-400">Bounce Rate</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Pages */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Most visited pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics as any)?.topPages?.slice(0, 5).map((page: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm">{page.path}</span>
                      <Badge variant="secondary">{page.views} views</Badge>
                    </div>
                  )) || (
                    <div className="text-center text-gray-500 py-8">
                      No page data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
                <CardDescription>Where visitors come from</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(analytics as any)?.trafficSources?.slice(0, 5).map((source: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-sm">{source.source}</span>
                      <Badge variant="secondary">{source.visitors} visitors</Badge>
                    </div>
                  )) || (
                    <div className="text-center text-gray-500 py-8">
                      No traffic data available yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Development Roadmap Tab */}
        <TabsContent value="roadmap" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Immediate Priority (Q1) */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-red-400">🔥 Immediate Priority</CardTitle>
                <CardDescription>Q1 2025 - Critical features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Gift className="h-5 w-5 text-red-400" />
                    <p className="font-medium text-red-400">Referral System</p>
                  </div>
                  <p className="text-sm text-gray-400">User referral program with tiered rewards and tracking dashboard</p>
                  <Badge variant="outline" className="mt-2 border-red-400 text-red-400">High Priority</Badge>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Smartphone className="h-5 w-5 text-red-400" />
                    <p className="font-medium text-red-400">Mobile App</p>
                  </div>
                  <p className="text-sm text-gray-400">Native mobile app for iOS and Android with full feature parity</p>
                  <Badge variant="outline" className="mt-2 border-red-400 text-red-400">High Priority</Badge>
                </div>

                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="h-5 w-5 text-red-400" />
                    <p className="font-medium text-red-400">Advanced Analytics</p>
                  </div>
                  <p className="text-sm text-gray-400">Comprehensive performance tracking and ROI analysis</p>
                  <Badge variant="outline" className="mt-2 border-red-400 text-red-400">High Priority</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Short Term (Q2) */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-yellow-400">⚡ Short Term</CardTitle>
                <CardDescription>Q2 2025 - Enhancement features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="h-5 w-5 text-yellow-400" />
                    <p className="font-medium text-yellow-400">Social Media Scheduler</p>
                  </div>
                  <p className="text-sm text-gray-400">Automated posting across multiple platforms with optimal timing</p>
                  <Badge variant="outline" className="mt-2 border-yellow-400 text-yellow-400">Medium Priority</Badge>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <VideoIcon className="h-5 w-5 text-yellow-400" />
                    <p className="font-medium text-yellow-400">Video Content Support</p>
                  </div>
                  <p className="text-sm text-gray-400">Video generation, editing tools, and protection features</p>
                  <Badge variant="outline" className="mt-2 border-yellow-400 text-yellow-400">Medium Priority</Badge>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <MessageSquare className="h-5 w-5 text-yellow-400" />
                    <p className="font-medium text-yellow-400">Community Features</p>
                  </div>
                  <p className="text-sm text-gray-400">Creator forums, collaboration tools, and peer support</p>
                  <Badge variant="outline" className="mt-2 border-yellow-400 text-yellow-400">Medium Priority</Badge>
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    <p className="font-medium text-yellow-400">API Integration</p>
                  </div>
                  <p className="text-sm text-gray-400">Public API for third-party integrations and custom tools</p>
                  <Badge variant="outline" className="mt-2 border-yellow-400 text-yellow-400">Medium Priority</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Long Term (Q3-Q4) */}
            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-green-400">🚀 Long Term</CardTitle>
                <CardDescription>Q3-Q4 2025 - Innovation features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Headphones className="h-5 w-5 text-green-400" />
                    <p className="font-medium text-green-400">Voice Content Generation</p>
                  </div>
                  <p className="text-sm text-gray-400">AI voice cloning and audio content creation</p>
                  <Badge variant="outline" className="mt-2 border-green-400 text-green-400">Future</Badge>
                </div>

                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <MonitorPlay className="h-5 w-5 text-green-400" />
                    <p className="font-medium text-green-400">Live Streaming Integration</p>
                  </div>
                  <p className="text-sm text-gray-400">Live cam integration with automated content generation</p>
                  <Badge variant="outline" className="mt-2 border-green-400 text-green-400">Future</Badge>
                </div>

                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-5 w-5 text-green-400" />
                    <p className="font-medium text-green-400">Multi-Language Support</p>
                  </div>
                  <p className="text-sm text-gray-400">Global expansion with localized content generation</p>
                  <Badge variant="outline" className="mt-2 border-green-400 text-green-400">Future</Badge>
                </div>

                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <FileCheck className="h-5 w-5 text-green-400" />
                    <p className="font-medium text-green-400">Compliance Automation</p>
                  </div>
                  <p className="text-sm text-gray-400">Automated age verification and platform compliance</p>
                  <Badge variant="outline" className="mt-2 border-green-400 text-green-400">Future</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Development Progress Overview */}
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>📊 Development Progress Overview</CardTitle>
              <CardDescription>Track feature completion and timeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-3xl font-bold text-green-400">85%</p>
                  <p className="text-sm text-gray-400">Core Platform</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-400">12</p>
                  <p className="text-sm text-gray-400">Features Planned</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-3xl font-bold text-blue-400">3</p>
                  <p className="text-sm text-gray-400">In Development</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg">
                  <p className="text-3xl font-bold text-purple-400">9</p>
                  <p className="text-sm text-gray-400">Months Timeline</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Q1 2025 Goals</span>
                  <span className="text-sm text-gray-400">3 of 3 features</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-red-500 to-red-400 h-2 rounded-full" style={{width: '33%'}}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Status Tab */}
        <TabsContent value="status" className="space-y-6">
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>System Completeness Status</CardTitle>
              <CardDescription>Track implementation progress and missing features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(completeness as any)?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.status === 'complete' ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : item.status === 'partial' ? (
                        <AlertCircle className="h-5 w-5 text-yellow-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                      <div>
                        <p className="font-medium">{item.category}</p>
                        <p className="text-sm text-gray-400">{item.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          item.status === 'complete' ? 'default' : 
                          item.status === 'partial' ? 'secondary' : 'destructive'
                        }
                        className="capitalize"
                      >
                        {item.status}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={
                          item.priority === 'high' ? 'border-red-400 text-red-400' :
                          item.priority === 'medium' ? 'border-yellow-400 text-yellow-400' :
                          'border-gray-400 text-gray-400'
                        }
                      >
                        {item.priority} priority
                      </Badge>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-gray-500 py-8">
                    Loading system status...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions for Missing Features */}
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>Priority Actions</CardTitle>
              <CardDescription>High-priority items that need attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {(completeness as any)?.filter((item: any) => item.priority === 'high' && item.status !== 'complete').map((item: any, index: number) => (
                  <div key={index} className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <XCircle className="h-5 w-5 text-red-400" />
                      <p className="font-medium text-red-400">{item.category}</p>
                    </div>
                    <p className="text-sm text-gray-400">{item.description}</p>
                  </div>
                )) || null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}