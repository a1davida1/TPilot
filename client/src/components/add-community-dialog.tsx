import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, type ApiError } from '@/lib/queryClient';
import { Plus, Search, Loader2, CheckCircle, AlertCircle, Users, Shield } from 'lucide-react';

interface LookupCommunityResponse {
  success: boolean;
  alreadyExists: boolean;
  community: {
    id: string;
    name: string;
    displayName: string;
    description: string;
    members: number;
    over18: boolean;
    verificationRequired: boolean;
    promotionAllowed: 'yes' | 'limited' | 'no' | 'unknown';
  };
}

interface AddCommunityDialogProps {
  onCommunityAdded?: () => void;
  trigger?: React.ReactNode;
}

export function AddCommunityDialog({ onCommunityAdded, trigger }: AddCommunityDialogProps) {
  const [open, setOpen] = useState(false);
  const [subredditName, setSubredditName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const lookupMutation = useMutation<LookupCommunityResponse, ApiError, string>({
    mutationFn: async (name: string) => {
      const cleanName = name.toLowerCase().replace(/^r\//, '').trim();
      const response = await apiRequest('POST', '/api/user-communities/lookup', { subreddit: cleanName });

      const payload: unknown = await response
        .json()
        .catch(() => ({ error: 'Failed to parse lookup response' }));

      if (!response.ok) {
        const message = typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : 'Failed to look up subreddit';
        const apiError = new Error(message) as ApiError;
        apiError.status = response.status;
        apiError.statusText = response.statusText;
        apiError.userMessage = message;
        apiError.responseBody = payload;
        throw apiError;
      }

      return payload as LookupCommunityResponse;
    },
    onSuccess: (data) => {
      if (data.alreadyExists) {
        toast({
          title: 'Community Already Available',
          description: `r/${data.community.name} is already in your community list!`
        });
      } else {
        toast({
          title: 'Community Added!',
          description: `r/${data.community.name} has been added successfully`
        });
      }

      // Refresh communities list
      queryClient.invalidateQueries({ queryKey: ['reddit-communities'] });

      // Close dialog and notify parent
      setOpen(false);
      setSubredditName('');
      onCommunityAdded?.();
    },
    onError: (error) => {
      const message = (error && typeof error === 'object' && 'userMessage' in error && typeof (error as ApiError).userMessage === 'string')
        ? (error as ApiError).userMessage
        : error instanceof Error
          ? error.message
          : 'Failed to look up subreddit';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subredditName.trim()) {
      lookupMutation.mutate(subredditName);
    }
  };

  const result = lookupMutation.data;
  const isLoading = lookupMutation.isPending;
  const hasError = lookupMutation.isError;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Community
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add a Subreddit</DialogTitle>
          <DialogDescription>
            Search for any subreddit and add it to your community list. We'll fetch the latest rules and requirements from Reddit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="subreddit-name">Subreddit Name</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">r/</span>
                <Input
                  id="subreddit-name"
                  placeholder="gonewild"
                  value={subredditName}
                  onChange={(e) => setSubredditName(e.target.value)}
                  className="pl-8"
                  disabled={isLoading}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={isLoading || !subredditName.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Look Up
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Enter the subreddit name without "r/" (we'll add that for you)
            </p>
          </div>

          {hasError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {lookupMutation.error instanceof Error ? lookupMutation.error.message : 'Subreddit not found or is private/banned'}
              </AlertDescription>
            </Alert>
          )}

          {result?.success && result.community && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2 mt-1">
                  <div>
                    <strong className="text-base">{result.community.displayName}</strong>
                    {result.alreadyExists && (
                      <Badge variant="secondary" className="ml-2">Already added</Badge>
                    )}
                    {!result.alreadyExists && (
                      <Badge variant="default" className="ml-2 bg-green-500">Newly added!</Badge>
                    )}
                  </div>

                  {result.community.description && (
                    <p className="text-sm text-gray-600">
                      {result.community.description.substring(0, 150)}
                      {result.community.description.length > 150 && '...'}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {result.community.members.toLocaleString()} members
                    </Badge>

                    {result.community.over18 && (
                      <Badge variant="destructive">NSFW</Badge>
                    )}

                    {result.community.verificationRequired && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Verification Required
                      </Badge>
                    )}

                    {result.community.promotionAllowed === 'yes' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Promotion Allowed
                      </Badge>
                    )}
                    {result.community.promotionAllowed === 'limited' && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        Limited Promotion
                      </Badge>
                    )}
                    {result.community.promotionAllowed === 'no' && (
                      <Badge variant="secondary" className="bg-red-100 text-red-800">
                        No Promotion
                      </Badge>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </form>

        {result?.success && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setOpen(false);
              setSubredditName('');
              lookupMutation.reset();
            }}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
