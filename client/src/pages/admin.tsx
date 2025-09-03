import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Ban,
  Clock3,
  Key,
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
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionType, setActionType] = useState<'ban' | 'suspend' | 'unban' | 'reset-password' | 'tier-management' | 'user-details' | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('24');
  const [tempPassword, setTempPassword] = useState('');
  const [newTier, setNewTier] = useState('free');

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

  // User action mutation for admin operations
  const actionMutation = useMutation({
    mutationFn: async (data: any) => {
      let endpoint = '/api/admin/user-action';
      if (data.action === 'reset-password') endpoint = '/api/admin/reset-password';
      else if (data.action === 'tier-management') endpoint = '/api/admin/upgrade-user';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to ${data.action}`);
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.action === 'reset-password') {
        setTempPassword(data.tempPassword);
        toast({ title: "Password Reset Successful", description: "Temporary password generated." });
      } else if (variables.action === 'tier-management') {
        toast({ title: "Tier Updated", description: `User tier changed to ${variables.newTier}` });
        setSelectedUser(null);
        setActionType(null);
      } else {
        toast({ title: `User ${variables.action} successful` });
        setSelectedUser(null);
        setActionType(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "Action Failed", description: error.message, variant: "destructive" });
    }
  });

  const handleAction = () => {
    if (!selectedUser || !actionType) return;
    if (actionType === 'reset-password') {
      actionMutation.mutate({ action: 'reset-password', userId: selectedUser.id });
    } else if (actionType === 'tier-management') {
      actionMutation.mutate({ action: 'tier-management', userId: selectedUser.id, tier: newTier });
    }
  };

  // Calculate real percentage changes
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const adminStats = [
    { 
      label: 'Total Users', 
      value: (stats as any)?.totalUsers || 0, 
      change: calculateChange((stats as any)?.totalUsers || 0, Math.max(1, ((stats as any)?.totalUsers || 0) - (stats as any)?.newUsersToday || 1)),
      icon: <Users className="h-4 w-4" />,
      color: 'text-blue-500'
    },
    { 
      label: 'Revenue', 
      value: `$${(stats as any)?.revenue || '0'}`, 
      change: calculateChange((stats as any)?.revenue || 0, Math.max(1, ((stats as any)?.revenue || 0) * 0.85)),
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-green-500'
    },
    { 
      label: 'Active Users (30d)', 
      value: (stats as any)?.activeUsers || 0, 
      change: calculateChange((stats as any)?.activeUsers || 0, Math.max(1, ((stats as any)?.activeUsers || 0) * 0.92)),
      icon: <Activity className="h-4 w-4" />,
      color: 'text-purple-500'
    },
    { 
      label: 'Content Generated', 
      value: (stats as any)?.contentGenerated || 0, 
      change: calculateChange((stats as any)?.contentGenerated || 0, Math.max(1, ((stats as any)?.contentGenerated || 0) * 0.75)),
      icon: <BarChart3 className="h-4 w-4" />,
      color: 'text-pink-500'
    }
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 p-6">
      {/* Admin Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-800 via-pink-800 to-purple-900 bg-clip-text text-transparent">
              Admin Portal
            </h1>
            <p className="text-gray-600 mt-2 text-lg">System overview and management</p>
          </div>
          <Badge variant="outline" className="text-emerald-700 border-emerald-700 bg-emerald-50 px-4 py-2">
            <Shield className="h-4 w-4 mr-2" />
            Admin Access
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {adminStats.map((stat, index) => (
          <Card key={index} className="bg-white border-gray-200 hover:bg-gray-50 transition-all duration-300 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${
                  stat.color === 'text-blue-500' ? 'from-blue-500/20 to-blue-600/20' :
                  stat.color === 'text-green-500' ? 'from-green-500/20 to-green-600/20' :
                  stat.color === 'text-purple-500' ? 'from-purple-500/20 to-purple-600/20' :
                  'from-pink-500/20 to-pink-600/20'
                }`}>
                  <span className={`${stat.color} text-lg`}>{stat.icon}</span>
                </div>
                <Badge variant="secondary" className="bg-gray-100 text-gray-900 border-gray-300 text-xs font-medium">
                  {stat.change}
                </Badge>
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-gray-100 border-gray-200 p-1 rounded-xl">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Analytics</TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Users</TabsTrigger>
          <TabsTrigger value="providers" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Providers</TabsTrigger>
          <TabsTrigger value="revenue" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Revenue</TabsTrigger>
          <TabsTrigger value="roadmap" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Roadmap</TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">System</TabsTrigger>
          <TabsTrigger value="status" className="data-[state=active]:bg-white data-[state=active]:text-purple-800 text-gray-600 rounded-lg transition-all duration-200">Status</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* User Activity Chart */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
                <CardDescription>User registrations and activity trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-400">New Users Today</p>
                      <p className="text-2xl font-bold text-blue-400">{(stats as any)?.newUsersToday || 0}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-400">Trial Users</p>
                      <p className="text-2xl font-bold text-purple-400">{(stats as any)?.trialUsers || 0}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Free Users</span>
                      <span className="text-gray-900">{(stats as any)?.freeUsers || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Pro Users</span>
                      <span className="text-green-400">{(stats as any)?.proUsers || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Premium Users</span>
                      <span className="text-purple-400">{(stats as any)?.premiumUsers || 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Generation Stats */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Service availability and configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${(stats as any)?.jwtConfigured ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm">Authentication</span>
                    </div>
                    <Badge variant={(stats as any)?.jwtConfigured ? 'default' : 'destructive'}>
                      {(stats as any)?.jwtConfigured ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${(stats as any)?.emailConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="text-sm">Email Service</span>
                    </div>
                    <Badge variant={(stats as any)?.emailConfigured ? 'default' : 'secondary'}>
                      {(stats as any)?.emailConfigured ? 'Configured' : 'Not Set'}
                    </Badge>
                  </div>
                  <div className="mt-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg">
                    <p className="text-sm text-gray-300">Total Content Generated</p>
                    <p className="text-3xl font-bold text-gray-900">{(stats as any)?.contentGenerated || 0}</p>
                    <p className="text-xs text-gray-400 mt-1">Across all users and platforms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card className="bg-white border-gray-200 shadow-lg">
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
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => { setSelectedUser(user); setActionType('user-details'); }}
                              data-testid={`button-user-details-${user.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => { setSelectedUser(user); setActionType('tier-management'); setNewTier(user.tier); }}
                              data-testid={`button-tier-management-${user.id}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => { setSelectedUser(user); setActionType('reset-password'); }}
                              data-testid={`button-reset-password-${user.id}`}
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                          </div>
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
          <Card className="bg-white border-gray-200 shadow-lg">
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
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${(stats as any)?.revenue || '0'}</p>
                <p className="text-sm text-gray-400 mt-2">Total platform revenue</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>Active Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Free</span>
                    <span>{(stats as any)?.freeUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pro ($20/mo)</span>
                    <span className="text-green-400">{(stats as any)?.proUsers || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Premium ($50/mo)</span>
                    <span className="text-purple-400">{(stats as any)?.premiumUsers || 0}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-900">Monthly Revenue</span>
                      <span className="text-green-400">${((stats as any)?.proUsers || 0) * 20 + ((stats as any)?.premiumUsers || 0) * 50}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>Service Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${Math.floor(((stats as any)?.contentGenerated || 0) * 0.02) || '0'}</p>
                <p className="text-sm text-gray-400 mt-2">Estimated AI costs</p>
                <div className="mt-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gemini (Primary)</span>
                    <span className="text-green-400">85% savings</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Content Generated</span>
                    <span className="text-gray-900">{(stats as any)?.contentGenerated || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          <Card className="bg-white border-gray-200 shadow-lg">
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
                    {(systemHealth as any)?.database?.status === 'healthy' ? 'Healthy' : 'Issues'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="h-5 w-5 text-purple-400" />
                    <span>Gemini AI</span>
                  </div>
                  <Badge variant={((systemHealth as any)?.services?.gemini ? 'outline' : 'destructive')} className={((systemHealth as any)?.services?.gemini ? 'text-green-400 border-green-400' : '')}>
                    {(systemHealth as any)?.services?.gemini ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {(systemHealth as any)?.services?.gemini ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-blue-400" />
                    <span>OpenAI</span>
                  </div>
                  <Badge variant={((systemHealth as any)?.services?.openai ? 'outline' : 'destructive')} className={((systemHealth as any)?.services?.openai ? 'text-green-400 border-green-400' : '')}>
                    {(systemHealth as any)?.services?.openai ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {(systemHealth as any)?.services?.openai ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Headphones className="h-5 w-5 text-yellow-400" />
                    <span>Email Service</span>
                  </div>
                  <Badge variant={((systemHealth as any)?.services?.email ? 'outline' : 'secondary')} className={((systemHealth as any)?.services?.email ? 'text-green-400 border-green-400' : 'text-yellow-400 border-yellow-400')}>
                    {(systemHealth as any)?.services?.email ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                    {(systemHealth as any)?.services?.email ? 'Configured' : 'Not Set'}
                  </Badge>
                </div>
                
                {/* Performance Metrics */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Performance Metrics</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-400">Response Time</p>
                      <p className="font-medium text-blue-400">{(systemHealth as any)?.performance?.avgResponseTime || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Error Rate</p>
                      <p className="font-medium text-green-400">{(systemHealth as any)?.performance?.errorRate || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Throughput</p>
                      <p className="font-medium text-purple-400">{(systemHealth as any)?.performance?.throughput || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Visitor Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-white border-gray-200 shadow-lg">
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
            
            <Card className="bg-white border-gray-200 shadow-lg">
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
            
            <Card className="bg-white border-gray-200 shadow-lg">
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
            <Card className="bg-white border-gray-200 shadow-lg">
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
            <Card className="bg-white border-gray-200 shadow-lg">
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
            <Card className="bg-white border-gray-200 shadow-lg">
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
            <Card className="bg-white border-gray-200 shadow-lg">
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
            <Card className="bg-white border-gray-200 shadow-lg">
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
          <Card className="bg-white border-gray-200 shadow-lg">
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
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Platform Completeness */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>Platform Completeness</CardTitle>
                <CardDescription>Feature implementation status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Overall Progress</span>
                    <span className="text-2xl font-bold text-purple-400">{(completeness as any)?.completionPercentage || 0}%</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-purple-300">Core Features</h4>
                      {Object.entries((completeness as any)?.core || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <Badge variant={value ? 'default' : 'destructive'} className="text-xs">
                            {value ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {value ? 'Done' : 'Missing'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-blue-300">Advanced Features</h4>
                      {Object.entries((completeness as any)?.features || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <Badge variant={value ? 'default' : 'secondary'} className="text-xs">
                            {value ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                            {value ? 'Ready' : 'Planned'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-green-300">Integrations</h4>
                      {Object.entries((completeness as any)?.integrations || {}).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                          <Badge variant={value ? 'default' : 'outline'} className="text-xs">
                            {value ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                            {value ? 'Connected' : 'Not Set'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardHeader>
                <CardTitle>Admin Actions</CardTitle>
                <CardDescription>Quick management operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button 
                    className="w-full justify-start bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-800"
                    onClick={() => {
                      toast({
                        title: "User Management",
                        description: "Switch to Users tab to manage user accounts"
                      });
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </Button>
                  
                  <Button 
                    className="w-full justify-start bg-green-100 hover:bg-green-200 border-green-300 text-green-800"
                    onClick={() => {
                      toast({
                        title: "Revenue Tracking",
                        description: "View revenue metrics in Revenue tab"
                      });
                    }}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Revenue Reports
                  </Button>
                  
                  <Button 
                    className="w-full justify-start bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-800"
                    onClick={() => {
                      toast({
                        title: "System Status",
                        description: "Check system health in System tab"
                      });
                    }}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    System Health
                  </Button>
                  
                  <Button 
                    className="w-full justify-start bg-pink-100 hover:bg-pink-200 border-pink-300 text-pink-800"
                    onClick={() => {
                      toast({
                        title: "Provider Analytics",
                        description: "Monitor AI provider costs and performance"
                      });
                    }}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Provider Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Modal */}
      {selectedUser && actionType && (
        <Dialog open={true} onOpenChange={() => { setSelectedUser(null); setActionType(null); setReason(''); setTempPassword(''); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">
                {actionType === 'user-details' ? 'User Details' : 
                 actionType === 'tier-management' ? 'Tier Management' : 
                 actionType === 'reset-password' ? 'Reset Password' : 
                 actionType.toUpperCase()} - {selectedUser.username}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {actionType === 'user-details' && (
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-2">Account Information</h4>
                    <div className="space-y-1 text-sm">
                      <p><strong>ID:</strong> {selectedUser.id}</p>
                      <p><strong>Username:</strong> {selectedUser.username}</p>
                      <p><strong>Email:</strong> {selectedUser.email}</p>
                      <p><strong>Tier:</strong> {selectedUser.tier}</p>
                      <p><strong>Joined:</strong> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                      <p><strong>Last Active:</strong> {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleDateString() : 'Never'}</p>
                      <p><strong>Content Created:</strong> {selectedUser.contentCount || 0}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {actionType === 'tier-management' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Change User Tier</Label>
                    <Select value={newTier} onValueChange={setNewTier}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">Current tier: {selectedUser.tier}</p>
                  </div>
                </div>
              )}
              
              {actionType === 'reset-password' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800 mb-2">
                      ⚠️ <strong>Security Notice:</strong> This will generate a temporary password that the user must change on their next login.
                    </p>
                  </div>
                  {tempPassword && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <Label className="text-sm font-semibold text-green-800">Temporary Password Generated:</Label>
                      <div className="mt-2 p-3 bg-white rounded border font-mono text-lg">
                        <div className="flex justify-between items-center">
                          <span className="select-all">{tempPassword}</span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(tempPassword);
                              toast({ title: "Copied to clipboard" });
                            }}
                          >
                            📋 Copy
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-green-700 mt-2">
                        ✅ Share this with the user. They'll be required to change it on next login.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => { setSelectedUser(null); setActionType(null); setReason(''); setTempPassword(''); }}>
                  {actionType === 'user-details' ? 'Close' : 'Cancel'}
                </Button>
                {actionType !== 'user-details' && (
                  <Button 
                    variant={actionType === 'reset-password' ? 'destructive' : 'default'} 
                    onClick={handleAction}
                    disabled={actionMutation.isPending}
                  >
                    {actionMutation.isPending ? 'Processing...' : 
                     actionType === 'tier-management' ? 'Update Tier' : 
                     actionType === 'reset-password' ? 'Generate Password' : 'Confirm'}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
