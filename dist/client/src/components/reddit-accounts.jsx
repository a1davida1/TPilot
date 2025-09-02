import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ExternalLink, CheckCircle, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
export function RedditAccounts() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    // Fetch connected Reddit accounts
    const { data: accounts, isLoading } = useQuery({
        queryKey: ['/api/reddit/accounts'],
        queryFn: () => apiRequest('GET', '/api/reddit/accounts').then(res => res.json())
    });
    // Test Reddit connection
    const testConnectionMutation = useMutation({
        mutationFn: () => apiRequest('POST', '/api/reddit/test').then(res => res.json()),
        onSuccess: (data) => {
            if (data.connected) {
                toast({
                    title: "Connection Successful",
                    description: `Connected as ${data.profile?.username}`,
                });
            }
            else {
                toast({
                    title: "Connection Failed",
                    description: "Unable to connect to Reddit. Please reconnect your account.",
                    variant: "destructive"
                });
            }
        },
        onError: (error) => {
            toast({
                title: "Connection Test Failed",
                description: "Unable to test Reddit connection",
                variant: "destructive"
            });
        }
    });
    // Disconnect Reddit account
    const disconnectMutation = useMutation({
        mutationFn: (accountId) => apiRequest('DELETE', `/api/reddit/accounts/${accountId}`).then(res => res.json()),
        onSuccess: () => {
            toast({
                title: "Account Disconnected",
                description: "Reddit account has been disconnected successfully",
            });
            queryClient.invalidateQueries({ queryKey: ['/api/reddit/accounts'] });
        },
        onError: (error) => {
            toast({
                title: "Disconnection Failed",
                description: "Unable to disconnect Reddit account",
                variant: "destructive"
            });
        }
    });
    // Connect to Reddit
    const connectToReddit = async () => {
        try {
            const response = await apiRequest('GET', '/api/reddit/connect').then(res => res.json());
            if (response.authUrl) {
                // Open Reddit OAuth in new window
                window.open(response.authUrl, '_blank', 'width=600,height=700');
                toast({
                    title: "Reddit Authorization",
                    description: "Please complete the authorization in the new window",
                });
            }
        }
        catch (error) {
            toast({
                title: "Connection Failed",
                description: "Unable to start Reddit connection process",
                variant: "destructive"
            });
        }
    };
    return (<div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Reddit Account Management</h2>
        <p className="text-gray-400">Connect your Reddit account to enable automated posting and community insights.</p>
      </div>

      {/* Connected Accounts */}
      <div className="space-y-4">
        {isLoading ? (<Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin text-gray-400"/>
                <span className="text-gray-400">Loading accounts...</span>
              </div>
            </CardContent>
          </Card>) : accounts && accounts.length > 0 ? (accounts.map((account) => (<Card key={account.id} className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-400"/>
                    <CardTitle className="text-lg text-gray-100">u/{account.username}</CardTitle>
                    {account.verified && (<Badge variant="outline" className="text-xs border-blue-500 text-blue-400">
                        Verified
                      </Badge>)}
                  </div>
                  <Badge className={account.isActive ? 'bg-green-500' : 'bg-gray-500'}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <CardDescription className="text-gray-400">
                  Connected on {new Date(account.connectedAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="text-gray-400">Karma:</span>
                      <span className="ml-1 text-gray-200 font-medium">{account.karma.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => testConnectionMutation.mutate()} disabled={testConnectionMutation.isPending} data-testid={`button-test-${account.id}`}>
                      {testConnectionMutation.isPending ? (<RefreshCw className="h-4 w-4 animate-spin"/>) : ("Test")}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => disconnectMutation.mutate(account.id)} disabled={disconnectMutation.isPending} data-testid={`button-disconnect-${account.id}`}>
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>))) : (<Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4"/>
              <h3 className="text-lg font-medium text-gray-200 mb-2">No Reddit Account Connected</h3>
              <p className="text-gray-400 mb-4">
                Connect your Reddit account to enable automated posting and access community insights.
              </p>
            </CardContent>
          </Card>)}
      </div>

      {/* Connect New Account */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">Connect Reddit Account</CardTitle>
          <CardDescription className="text-gray-400">
            Link your Reddit account to enable automated posting and community features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connectToReddit} className="w-full" data-testid="button-connect-reddit">
            <ExternalLink className="h-4 w-4 mr-2"/>
            Connect to Reddit
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            You'll be redirected to Reddit to authorize the connection. We only request the minimum permissions needed.
          </p>
        </CardContent>
      </Card>

      {/* Features Info */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100">What you can do with Reddit connected:</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400"/>
              <span>Automatically post content to your favorite subreddits</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400"/>
              <span>Get personalized subreddit recommendations</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400"/>
              <span>Access community insights and analytics</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400"/>
              <span>Schedule posts for optimal timing</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>);
}
