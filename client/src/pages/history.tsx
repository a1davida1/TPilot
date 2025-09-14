import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { History, Search, Filter, Calendar, Download, Share2, Trash2, Star, Copy, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import type { ContentGeneration } from '@shared/schema.js';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: generations = [], isLoading } = useQuery<ContentGeneration[]>({
    queryKey: ['/api/content-generations'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/content-generations/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-generations'] });
      toast({
        title: "Content deleted",
        description: "The content has been removed from your history.",
      });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (generation: ContentGeneration) => {
      return apiRequest('/api/saved-content', 'POST', {
        title: Array.isArray(generation.titles) ? generation.titles[0] || 'Untitled' : 'Untitled',
        content: generation.content,
        platform: generation.platform,
        generationId: generation.id
      });
    },
    onSuccess: () => {
      toast({
        title: "Content saved",
        description: "Added to your saved favorites.",
      });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Content copied to clipboard.",
    });
  };

  const filteredGenerations = generations.filter(gen => {
    const titles = Array.isArray(gen.titles) ? gen.titles : [];
    const matchesSearch = searchQuery === '' || 
      gen.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      titles.some((title: string) => title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesPlatform = filterPlatform === 'all' || gen.platform === filterPlatform;
    const matchesType = filterType === 'all' || gen.generationType === filterType;
    
    return matchesSearch && matchesPlatform && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <History className="mr-2 h-6 w-6 text-blue-600" />
                  Content History
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-8 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2 text-blue-600" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Search content</label>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-gray-300"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Platform</label>
                <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ai">AI Generated</SelectItem>
                    <SelectItem value="template">Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{generations.length}</div>
              <div className="text-sm text-gray-600">Total Generated</div>
            </CardContent>
          </Card>
          <Card className="text-center shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {generations.filter(g => g.generationType === 'ai').length}
              </div>
              <div className="text-sm text-muted-foreground">AI Generated</div>
            </CardContent>
          </Card>
          <Card className="text-center shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">
                {generations.filter(g => g.platform === 'reddit').length}
              </div>
              <div className="text-sm text-muted-foreground">Reddit Posts</div>
            </CardContent>
          </Card>
          <Card className="text-center shadow-md border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">{filteredGenerations.length}</div>
              <div className="text-sm text-muted-foreground">Filtered Results</div>
            </CardContent>
          </Card>
        </div>

        {/* Content List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading your content history...</p>
          </div>
        ) : filteredGenerations.length === 0 ? (
          <Card className="text-center py-12 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <CardContent>
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterPlatform !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Start generating content to see your history here'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredGenerations.map((generation) => (
              <Card key={generation.id} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={generation.generationType === 'ai' ? 'default' : 'secondary'}>
                          {generation.generationType === 'ai' ? 'AI Generated' : 'Template'}
                        </Badge>
                        <Badge variant="outline">{generation.platform}</Badge>
                        {generation.subreddit && (
                          <Badge variant="outline">r/{generation.subreddit}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">
                        {Array.isArray(generation.titles) ? generation.titles[0] || 'Untitled' : 'Untitled'}
                      </CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {generation.createdAt ? new Date(generation.createdAt).toLocaleDateString() : 'Unknown date'}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generation.content)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveMutation.mutate(generation)}
                        disabled={saveMutation.isPending}
                      >
                        <ThottoPilotLogo size="sm" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(generation.id.toString())}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {generation.content}
                    </p>
                  </div>
                  
                  {Array.isArray(generation.titles) && generation.titles.length > 1 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Alternative Titles:</h4>
                      <div className="space-y-1">
                        {generation.titles.slice(1).map((title: string, index: number) => (
                          <div key={index} className="text-sm text-gray-600 bg-gray-100 rounded px-2 py-1">
                            {title}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}