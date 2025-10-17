import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Heart, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface FeedbackItem {
  id: number;
  type: 'bug' | 'feature' | 'general' | 'praise';
  message: string;
  status: 'pending' | 'in-progress' | 'resolved';
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface FeedbackStats {
  byType: Array<{
    type: string;
    count: number;
    resolved: number;
  }>;
  totals: {
    total: number;
    pending: number;
    resolved: number;
    avgResponseTime: string | null;
  };
  lastUpdated: string;
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Fetch user's feedback
  const { data: userFeedback, isLoading: isLoadingFeedback } = useQuery<{ feedback: FeedbackItem[]; count: number }>({
    queryKey: ['/api/feedback/my-feedback'],
    enabled: !!user
  });

  // Fetch feedback stats
  const { data: stats, isLoading: isLoadingStats } = useQuery<FeedbackStats>({
    queryKey: ['/api/feedback/stats']
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <Bug className="h-4 w-4" />;
      case 'feature':
        return <Lightbulb className="h-4 w-4" />;
      case 'praise':
        return <Heart className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'bug':
        return 'text-red-500 bg-red-50 border-red-200';
      case 'feature':
        return 'text-blue-500 bg-blue-50 border-blue-200';
      case 'praise':
        return 'text-pink-500 bg-pink-50 border-pink-200';
      default:
        return 'text-purple-500 bg-purple-50 border-purple-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Pending</Badge>;
      case 'in-progress':
        return <Badge variant="outline" className="border-blue-500 text-blue-700">In Progress</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="border-green-500 text-green-700">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredFeedback = userFeedback?.feedback.filter(item => {
    if (selectedType !== 'all' && item.type !== selectedType) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    return true;
  }) || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Feedback Center
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Track your feedback and see what others are saying
        </p>
      </div>

      {/* Stats Overview */}
      {isLoadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Feedback</p>
                  <p className="text-2xl font-bold">{stats.totals.total}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.totals.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold">{stats.totals.resolved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Response</p>
                  <p className="text-2xl font-bold">{stats.totals.avgResponseTime || 'N/A'}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="my-feedback" className="space-y-4">
        <TabsList>
          <TabsTrigger value="my-feedback">My Feedback</TabsTrigger>
          <TabsTrigger value="community">Community Stats</TabsTrigger>
        </TabsList>

        {/* My Feedback Tab */}
        <TabsContent value="my-feedback">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Feedback</CardTitle>
                  <CardDescription>Track the status of your submissions</CardDescription>
                </div>
                {/* Filters */}
                <div className="flex gap-2">
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="praise">Praise</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingFeedback ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredFeedback.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-600">No feedback yet</p>
                  <p className="text-sm text-gray-500 mt-1">Click the feedback button to share your thoughts!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFeedback.map((item) => (
                    <div key={item.id} className={cn(
                      "p-4 border rounded-lg",
                      getTypeColor(item.type)
                    )}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(item.type)}
                          <span className="font-medium capitalize">{item.type}</span>
                          {getStatusBadge(item.status)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{item.message}</p>
                      
                      {item.adminNotes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-gray-600 mb-1">Admin Response:</p>
                          <p className="text-sm text-gray-700">{item.adminNotes}</p>
                        </div>
                      )}
                      
                      {item.resolvedAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Resolved {formatDistanceToNow(new Date(item.resolvedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Community Stats Tab */}
        <TabsContent value="community">
          <Card>
            <CardHeader>
              <CardTitle>Community Feedback Stats</CardTitle>
              <CardDescription>See what the community is talking about</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : stats && (
                <div className="space-y-6">
                  {/* Feedback by Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.byType.map((type) => (
                      <Card key={type.type} className="relative overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            {getTypeIcon(type.type)}
                            <span className="text-sm font-medium capitalize">{type.type}</span>
                          </div>
                          <p className="text-2xl font-bold">{type.count}</p>
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Resolved</span>
                              <span>{type.resolved}/{type.count}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                                style={{ width: `${(type.resolved / type.count) * 100}%` }}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Info Alert */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Beta Program:</strong> Your feedback is crucial for improving ThottoPilot. 
                      We review all submissions and typically respond within 24-48 hours.
                    </AlertDescription>
                  </Alert>

                  {/* Last Updated */}
                  <p className="text-xs text-center text-muted-foreground">
                    Last updated: {format(new Date(stats.lastUpdated), 'PPpp')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feedback Widget is globally available */}
    </div>
  );
}
