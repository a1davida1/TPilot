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
  XCircle
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

  const adminStats = [
    { 
      label: 'Total Users', 
      value: stats?.totalUsers || 0, 
      change: '+12%',
      icon: <Users className="h-4 w-4" />,
      color: 'text-blue-500'
    },
    { 
      label: 'Revenue', 
      value: `$${stats?.revenue || '0'}`, 
      change: '+23%',
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-green-500'
    },
    { 
      label: 'Active Users (30d)', 
      value: stats?.activeUsers || 0, 
      change: '+5%',
      icon: <Activity className="h-4 w-4" />,
      color: 'text-purple-500'
    },
    { 
      label: 'Content Generated', 
      value: stats?.contentGenerated || 0, 
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
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="providers">AI Providers</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
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
                    {users?.slice(0, 5).map((user: any) => (
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

        {/* AI Providers Tab */}
        <TabsContent value="providers" className="space-y-6">
          <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
            <CardHeader>
              <CardTitle>AI Provider Costs & Status</CardTitle>
              <CardDescription>Monitor API usage and costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {providers?.map((provider: any) => (
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
                <p className="text-3xl font-bold">${stats?.monthlyRevenue || '0'}</p>
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
                    <span>{stats?.subscriptions?.free || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pro</span>
                    <span>{stats?.subscriptions?.pro || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Premium</span>
                    <span>{stats?.subscriptions?.premium || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle>API Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${stats?.apiCosts || '0'}</p>
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
                    <span>API Services</span>
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
      </Tabs>
    </div>
  );
}