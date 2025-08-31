import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, Activity, Play, Pause, RefreshCw, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface QueueMetrics {
  pending: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  failureRate: number;
  throughput: number;
  avgProcessingTime: number;
  lastProcessed?: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

interface WorkerMetrics {
  name: string;
  status: 'running' | 'stopped' | 'error';
  concurrency: number;
  processed: number;
  failed: number;
  uptime: number;
  memoryUsage: number;
  lastActivity?: string;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  queues: number;
  workers: number;
  totalPending: number;
  totalFailed: number;
  avgFailureRate: number;
}

export function QueueDashboard() {
  const [queueMetrics, setQueueMetrics] = useState<Record<string, QueueMetrics>>({});
  const [workerMetrics, setWorkerMetrics] = useState<Record<string, WorkerMetrics>>({});
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const [queueData, workerData, healthData] = await Promise.all([
        apiRequest('GET', '/api/admin/queue-metrics'),
        apiRequest('GET', '/api/admin/worker-metrics'),
        apiRequest('GET', '/api/admin/system-health'),
      ]);

      setQueueMetrics(queueData);
      setWorkerMetrics(workerData);
      setSystemHealth(healthData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  };

  const handleQueueAction = async (queueName: string, action: string) => {
    try {
      await apiRequest('POST', '/api/admin/queue-action', {
        queueName,
        action,
      });

      toast({
        title: 'Action Completed',
        description: `${action} executed for ${queueName} queue`,
      });

      // Refresh metrics
      fetchMetrics();
    } catch (error: any) {
      toast({
        title: 'Action Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Warning</Badge>;
      case 'critical':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading queue metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="queue-dashboard">
      {/* System Overview */}
      {systemHealth && (
        <Card className="bg-black/40 border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
              {getHealthBadge(systemHealth.overall)}
            </CardTitle>
            <CardDescription>
              {systemHealth.queues} queues, {systemHealth.workers} workers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{systemHealth.totalPending}</div>
                <div className="text-sm text-muted-foreground">Pending Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{systemHealth.totalFailed}</div>
                <div className="text-sm text-muted-foreground">Failed Jobs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">{(systemHealth.avgFailureRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-muted-foreground">Failure Rate</div>
              </div>
              <div className="text-center">
                <Button onClick={fetchMetrics} size="sm" variant="outline" data-testid="button-refresh">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="queues" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="queues">Queue Status</TabsTrigger>
          <TabsTrigger value="workers">Worker Status</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(queueMetrics).map(([queueName, metrics]) => (
              <Card key={queueName} className="bg-black/40 border-purple-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {queueName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      {getHealthBadge(metrics.healthStatus)}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queueName, 'pause')}
                        data-testid={`button-pause-${queueName}`}
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queueName, 'resume')}
                        data-testid={`button-resume-${queueName}`}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQueueAction(queueName, 'retry')}
                        data-testid={`button-retry-${queueName}`}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleQueueAction(queueName, 'clear')}
                        data-testid={`button-clear-${queueName}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    Throughput: {metrics.throughput} jobs/hour | Avg: {Math.round(metrics.avgProcessingTime)}ms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-400">{metrics.pending}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-yellow-400">{metrics.active}</div>
                      <div className="text-xs text-muted-foreground">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-400">{metrics.completed}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-400">{metrics.failed}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-purple-400">{metrics.delayed}</div>
                      <div className="text-xs text-muted-foreground">Delayed</div>
                    </div>
                  </div>
                  
                  {/* Failure Rate Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Failure Rate</span>
                      <span>{(metrics.failureRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={metrics.failureRate * 100} 
                      className="h-2"
                      style={{
                        '--progress-background': metrics.failureRate > 0.5 ? 'rgb(239 68 68)' :
                                              metrics.failureRate > 0.2 ? 'rgb(245 158 11)' : 'rgb(34 197 94)'
                      } as any}
                    />
                  </div>

                  {metrics.lastProcessed && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Last processed: {new Date(metrics.lastProcessed).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <div className="grid gap-4">
            {Object.entries(workerMetrics).map(([workerName, metrics]) => (
              <Card key={workerName} className="bg-black/40 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      {workerName.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <Badge variant={metrics.status === 'running' ? 'default' : 'destructive'}>
                      {metrics.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Concurrency: {metrics.concurrency} | Memory: {(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-400">{metrics.processed}</div>
                      <div className="text-xs text-muted-foreground">Processed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-400">{metrics.failed}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-400">
                        {Math.round(metrics.uptime / 60000)}m
                      </div>
                      <div className="text-xs text-muted-foreground">Uptime</div>
                    </div>
                  </div>

                  {metrics.lastActivity && (
                    <div className="text-xs text-muted-foreground">
                      Last activity: {new Date(metrics.lastActivity).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}