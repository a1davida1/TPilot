import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { FileText, Gift, Shield, DollarSign, Download, BookOpen, Tag, Percent, Calculator, Lock, Star, TrendingUp, Users, Heart, Sparkles, CheckCircle, ExternalLink, Copy, Search, Award, Clock, Bookmark, Eye, Calendar, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
export function ProPerks({ userTier = 'pro' }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [selectedResource, setSelectedResource] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState({});
    const [bookmarkedItems, setBookmarkedItems] = useState(new Set());
    const [recentActivity, setRecentActivity] = useState([]);
    const { toast } = useToast();
    // Fetch real resources from API
    const { data: resourcesData, isLoading: resourcesLoading } = useQuery({
        queryKey: ['pro-resources'],
        queryFn: async () => {
            const token = localStorage.getItem('authToken');
            if (!token)
                return { resources: [] };
            try {
                const response = await fetch('/api/pro-resources', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok)
                    throw new Error('Failed to fetch resources');
                return response.json();
            }
            catch (error) {
                return { resources: [] };
            }
        }
    });
    const resources = resourcesData?.resources || [];
    // Show empty state when no resources available
    if (!resourcesLoading && resources.length === 0) {
        return (<Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-400"/>
            Pro Perks & Resources
          </CardTitle>
          <CardDescription>
            Exclusive resources and discounts for Pro users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4"/>
            <p className="text-gray-400">Resources coming soon!</p>
            <p className="text-sm text-gray-500 mt-2">We're partnering with top platforms to bring you exclusive discounts</p>
          </div>
        </CardContent>
      </Card>);
    }
    const sampleForDevelopment = [{
            id: '1',
            title: 'Content Creator Tax Guide 2025',
            description: 'Complete guide to managing taxes as an adult content creator, including deductions and quarterly payments',
            category: 'tax',
            type: 'pdf',
            downloads: 1842,
            rating: 4.8
        },
        {
            id: '2',
            title: 'Building Your Personal Brand',
            description: 'Step-by-step strategies for creating a memorable and profitable personal brand',
            category: 'business',
            type: 'ebook',
            downloads: 2156,
            rating: 4.9
        },
        {
            id: '3',
            title: 'Social Media Safety & Privacy Guide',
            description: 'Protect your identity and maintain privacy while building your online presence',
            category: 'safety',
            type: 'pdf',
            downloads: 3421,
            rating: 5.0
        },
        {
            id: '4',
            title: 'Photography & Lighting Masterclass',
            description: 'Professional photography techniques for content creators on any budget',
            category: 'skills',
            type: 'ebook',
            downloads: 1523,
            rating: 4.7
        },
        {
            id: '5',
            title: 'Mental Health for Content Creators',
            description: 'Managing stress, burnout, and maintaining work-life balance in the digital age',
            category: 'wellness',
            type: 'pdf',
            downloads: 892,
            rating: 4.9
        },
        {
            id: '6',
            title: 'Legal Rights & Contracts Guide',
            description: 'Understanding your rights, DMCA, and contract negotiations',
            category: 'legal',
            type: 'pdf',
            downloads: 1234,
            rating: 4.8
        },
        // Coupons & Discounts
        {
            id: '7',
            title: '40% Off DeleteMe Service',
            description: 'Remove your personal information from 100+ data broker sites',
            category: 'privacy',
            type: 'coupon',
            value: 'THOTTO40',
            savedAmount: '$60',
            validUntil: '2025-12-31',
            externalUrl: 'https://deleteme.com'
        },
        {
            id: '8',
            title: '30% Off Professional Photo Editing',
            description: 'Premium photo editing and retouching services from verified professionals',
            category: 'services',
            type: 'discount',
            value: 'CREATOR30',
            savedAmount: '$45/month',
            validUntil: '2025-09-30'
        },
        {
            id: '9',
            title: 'Free Month of VPN Service',
            description: 'Protect your online activity and access content from anywhere',
            category: 'privacy',
            type: 'coupon',
            value: 'THOTTOVPN',
            savedAmount: '$12.99',
            validUntil: '2025-08-31'
        },
        {
            id: '10',
            title: '50% Off QuickBooks Self-Employed',
            description: 'Track income, expenses, and maximize tax deductions automatically',
            category: 'tax',
            type: 'discount',
            value: 'CREATOR50',
            savedAmount: '$7.50/month',
            validUntil: '2025-12-31'
        },
        {
            id: '11',
            title: '25% Off Ring Light Equipment',
            description: 'Professional lighting equipment for content creation',
            category: 'equipment',
            type: 'coupon',
            value: 'LIGHT25',
            savedAmount: 'Up to $50',
            validUntil: '2025-10-31'
        },
        // Services
        {
            id: '12',
            title: 'Free Tax Consultation',
            description: '30-minute consultation with a CPA specializing in content creator taxes',
            category: 'tax',
            type: 'service',
            isPremium: true,
            savedAmount: '$150 value'
        },
        {
            id: '13',
            title: 'Online Reputation Cleanup',
            description: 'Professional service to remove unwanted content and protect your reputation',
            category: 'privacy',
            type: 'service',
            isPremium: true,
            savedAmount: '$500 value'
        },
        {
            id: '14',
            title: 'Legal Document Templates',
            description: 'Customizable contracts, model releases, and DMCA templates',
            category: 'legal',
            type: 'service',
            downloads: 567
        },
        {
            id: '15',
            title: 'Content Planning Calendar',
            description: '12-month content calendar template with optimal posting times',
            category: 'business',
            type: 'pdf',
            downloads: 2341,
            rating: 4.6
        }
    ];
    const categories = [
        { id: 'all', label: 'All Perks', icon: Sparkles },
        { id: 'tax', label: 'Tax & Finance', icon: Calculator },
        { id: 'privacy', label: 'Privacy & Safety', icon: Shield },
        { id: 'business', label: 'Business Growth', icon: TrendingUp },
        { id: 'skills', label: 'Skills & Education', icon: BookOpen },
        { id: 'services', label: 'Services', icon: Users },
        { id: 'legal', label: 'Legal', icon: FileText },
        { id: 'wellness', label: 'Wellness', icon: Heart }
    ];
    const filteredResources = resources.filter(resource => {
        const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            resource.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'all' || resource.category === activeCategory;
        return matchesSearch && matchesCategory;
    });
    const handleDownload = (resource) => {
        setDownloadProgress(prev => ({ ...prev, [resource.id]: 0 }));
        // Simulate download progress
        const interval = setInterval(() => {
            setDownloadProgress(prev => {
                const currentProgress = prev[resource.id] || 0;
                const newProgress = Math.min(currentProgress + Math.random() * 30, 100);
                if (newProgress >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setDownloadProgress(prev => {
                            const updated = { ...prev };
                            delete updated[resource.id];
                            return updated;
                        });
                        // Add to recent activity
                        setRecentActivity(prev => [
                            { id: resource.id, action: 'downloaded', timestamp: new Date() },
                            ...prev.slice(0, 4)
                        ]);
                        toast({
                            title: "Download Complete!",
                            description: `${resource.title} has been downloaded successfully`
                        });
                    }, 500);
                    return { ...prev, [resource.id]: 100 };
                }
                return { ...prev, [resource.id]: newProgress };
            });
        }, 200);
    };
    const copyCoupon = (code, resourceTitle) => {
        navigator.clipboard.writeText(code);
        // Add to recent activity
        setRecentActivity(prev => [
            { id: Date.now().toString(), action: 'copied coupon', timestamp: new Date() },
            ...prev.slice(0, 4)
        ]);
        toast({
            title: "Coupon Copied!",
            description: `Code "${code}" for ${resourceTitle} copied to clipboard`
        });
    };
    const toggleBookmark = (resourceId) => {
        setBookmarkedItems(prev => {
            const updated = new Set(prev);
            if (updated.has(resourceId)) {
                updated.delete(resourceId);
                toast({
                    title: "Bookmark Removed",
                    description: "Resource removed from your bookmarks"
                });
            }
            else {
                updated.add(resourceId);
                toast({
                    title: "Bookmarked!",
                    description: "Resource added to your bookmarks"
                });
            }
            return updated;
        });
    };
    const getResourceIcon = (type) => {
        switch (type) {
            case 'pdf': return <FileText className="h-5 w-5"/>;
            case 'ebook': return <BookOpen className="h-5 w-5"/>;
            case 'coupon': return <Tag className="h-5 w-5"/>;
            case 'discount': return <Percent className="h-5 w-5"/>;
            case 'service': return <Users className="h-5 w-5"/>;
            default: return <Gift className="h-5 w-5"/>;
        }
    };
    const getResourceBadge = (type) => {
        const badges = {
            pdf: 'PDF',
            ebook: 'Ebook',
            coupon: 'Coupon',
            discount: 'Discount',
            service: 'Service'
        };
        return badges[type] || type;
    };
    return (<div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ProPerks Library
              </CardTitle>
              <CardDescription className="text-gray-300 mt-2">
                Exclusive resources, discounts, and tools for professional creators
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                PRO MEMBER
              </Badge>
              <p className="text-sm text-gray-400 mt-2">Access to {resources.length}+ perks</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search and Filter */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"/>
          <Input placeholder="Search perks, guides, and discounts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-gray-900/50 border-purple-500/20"/>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
            const Icon = category.icon;
            return (<Button key={category.id} variant={activeCategory === category.id ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(category.id)} className={activeCategory === category.id
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0"
                    : "border-purple-500/30 hover:bg-purple-500/10"}>
              <Icon className="h-4 w-4 mr-2"/>
              {category.label}
            </Button>);
        })}
      </div>

      {/* Recent Activity Sidebar */}
      {recentActivity.length > 0 && (<Card className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5"/>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.map((activity, index) => (<div key={index} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-gray-300">
                    You {activity.action} a resource {activity.timestamp.toLocaleTimeString()}
                  </span>
                </div>))}
            </div>
          </CardContent>
        </Card>)}

      {/* Resources Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResources.map((resource) => (<Card key={resource.id} className="bg-gray-900/50 border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group cursor-pointer">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                    {getResourceIcon(resource.type)}
                  </div>
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                    {getResourceBadge(resource.type)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  {resource.isPremium && (<Award className="h-4 w-4 text-yellow-500"/>)}
                  <Button size="sm" variant="ghost" onClick={(e) => {
                e.stopPropagation();
                toggleBookmark(resource.id);
            }} className="p-1 h-auto text-gray-400 hover:text-yellow-400">
                    <Bookmark className={`h-4 w-4 ${bookmarkedItems.has(resource.id) ? 'fill-yellow-400 text-yellow-400' : ''}`}/>
                  </Button>
                </div>
              </div>
              <div onClick={() => setSelectedResource(resource)}>
                <CardTitle className="text-lg mt-3 group-hover:text-purple-300 transition-colors">
                  {resource.title}
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm line-clamp-2">
                  {resource.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Download Progress */}
              {downloadProgress[resource.id] !== undefined && (<div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Downloading...</span>
                    <span className="text-purple-400">{Math.round(downloadProgress[resource.id])}%</span>
                  </div>
                  <Progress value={downloadProgress[resource.id]} className="h-2"/>
                </div>)}

              {/* Metadata */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                {resource.downloads && (<div className="flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded">
                    <Download className="h-3 w-3"/>
                    {resource.downloads.toLocaleString()}
                  </div>)}
                {resource.rating && (<div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded">
                    <Star className="h-3 w-3 text-yellow-500"/>
                    {resource.rating}
                  </div>)}
                {resource.savedAmount && (<div className="flex items-center gap-1 text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    <DollarSign className="h-3 w-3"/>
                    Save {resource.savedAmount}
                  </div>)}
                {resource.validUntil && (<div className="text-orange-400 bg-orange-500/10 px-2 py-1 rounded flex items-center gap-1">
                    <Calendar className="h-3 w-3"/>
                    Valid until {new Date(resource.validUntil).toLocaleDateString()}
                  </div>)}
              </div>

              {/* Coupon Code */}
              {resource.value && (<div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                  <code className="flex-1 text-purple-300 font-mono font-bold">{resource.value}</code>
                  <Button size="sm" variant="ghost" onClick={(e) => {
                    e.stopPropagation();
                    copyCoupon(resource.value, resource.title);
                }} className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20">
                    <Copy className="h-4 w-4"/>
                  </Button>
                </div>)}

              {/* Actions */}
              <div className="flex gap-2">
                {resource.downloadUrl !== undefined ? (<Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(resource);
                }} disabled={downloadProgress[resource.id] !== undefined}>
                    {downloadProgress[resource.id] !== undefined ? (<>
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Downloading...
                      </>) : (<>
                        <Download className="h-4 w-4 mr-2"/>
                        Download
                      </>)}
                  </Button>) : resource.externalUrl ? (<Button className="flex-1" variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    window.open(resource.externalUrl, '_blank');
                }}>
                    <ExternalLink className="h-4 w-4 mr-2"/>
                    Visit Site
                  </Button>) : resource.type === 'service' ? (<Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500" size="sm">
                    <CheckCircle className="h-4 w-4 mr-2"/>
                    Claim Now
                  </Button>) : (<Button className="flex-1" variant="outline" size="sm">
                    <Lock className="h-4 w-4 mr-2"/>
                    Coming Soon
                  </Button>)}
                
                <Button variant="outline" size="sm" onClick={() => setSelectedResource(resource)} className="px-3">
                  <Eye className="h-4 w-4"/>
                </Button>
              </div>
            </CardContent>
          </Card>))}
      </div>

      {/* Resource Detail Modal */}
      <Dialog open={!!selectedResource} onOpenChange={() => setSelectedResource(null)}>
        <DialogContent className="max-w-2xl bg-gray-900 border-purple-500/30">
          {selectedResource && (<>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    {getResourceIcon(selectedResource.type)}
                  </div>
                  <div>
                    <DialogTitle className="text-xl text-white">{selectedResource.title}</DialogTitle>
                    <Badge variant="outline" className="border-purple-500/50 text-purple-300 mt-1">
                      {getResourceBadge(selectedResource.type)}
                    </Badge>
                  </div>
                </div>
                <DialogDescription className="text-gray-300 text-base leading-relaxed">
                  {selectedResource.description}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Resource Stats */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedResource.downloads && (<div className="bg-gray-800/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Download className="h-4 w-4"/>
                        Downloads
                      </div>
                      <div className="text-xl font-bold text-white">
                        {selectedResource.downloads.toLocaleString()}
                      </div>
                    </div>)}
                  {selectedResource.rating && (<div className="bg-gray-800/50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Star className="h-4 w-4"/>
                        Rating
                      </div>
                      <div className="text-xl font-bold text-yellow-400">
                        {selectedResource.rating}/5.0
                      </div>
                    </div>)}
                </div>

                {/* Additional Info */}
                {selectedResource.savedAmount && (<div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-400"/>
                      <span className="text-green-400 font-medium">
                        Save {selectedResource.savedAmount} with this resource
                      </span>
                    </div>
                  </div>)}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  {selectedResource.downloadUrl !== undefined ? (<Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500" onClick={() => {
                    handleDownload(selectedResource);
                    setSelectedResource(null);
                }}>
                      <Download className="h-4 w-4 mr-2"/>
                      Download Resource
                    </Button>) : selectedResource.externalUrl ? (<Button className="flex-1" onClick={() => {
                    window.open(selectedResource.externalUrl, '_blank');
                    setSelectedResource(null);
                }}>
                      <ExternalLink className="h-4 w-4 mr-2"/>
                      Visit Website
                    </Button>) : (<Button className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500">
                      <CheckCircle className="h-4 w-4 mr-2"/>
                      Get Access
                    </Button>)}
                  
                  <Button variant="outline" onClick={() => toggleBookmark(selectedResource.id)}>
                    <Bookmark className={`h-4 w-4 mr-2 ${bookmarkedItems.has(selectedResource.id) ? 'fill-yellow-400 text-yellow-400' : ''}`}/>
                    {bookmarkedItems.has(selectedResource.id) ? 'Bookmarked' : 'Bookmark'}
                  </Button>
                </div>
              </div>
            </>)}
        </DialogContent>
      </Dialog>

      {/* Enhanced Stats Section */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border-green-500/30 hover:border-green-500/50 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Total Savings</p>
                <p className="text-2xl font-bold text-green-400 tabular-nums">$1,247</p>
                <p className="text-xs text-green-400/70 mt-1">+$124 this month</p>
              </div>
              <div className="relative">
                <DollarSign className="h-8 w-8 text-green-400/50"/>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-900/20 to-violet-900/20 border-purple-500/30 hover:border-purple-500/50 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Resources Used</p>
                <p className="text-2xl font-bold text-purple-400 tabular-nums">23</p>
                <p className="text-xs text-purple-400/70 mt-1">{bookmarkedItems.size} bookmarked</p>
              </div>
              <FileText className="h-8 w-8 text-purple-400/50"/>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-pink-900/20 to-rose-900/20 border-pink-500/30 hover:border-pink-500/50 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Active Discounts</p>
                <p className="text-2xl font-bold text-pink-400 tabular-nums">8</p>
                <p className="text-xs text-pink-400/70 mt-1">3 expiring soon</p>
              </div>
              <Tag className="h-8 w-8 text-pink-400/50"/>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-900/20 to-amber-900/20 border-orange-500/30 hover:border-orange-500/50 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">New This Month</p>
                <p className="text-2xl font-bold text-orange-400 tabular-nums">5</p>
                <p className="text-xs text-orange-400/70 mt-1">2 added today</p>
              </div>
              <div className="relative">
                <Sparkles className="h-8 w-8 text-orange-400/50"/>
                <Zap className="absolute -top-1 -right-1 h-4 w-4 text-orange-400 animate-bounce"/>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredResources.length === 0 && (<Card className="p-12 text-center bg-gray-900/30 border-gray-600/30">
          <Search className="h-16 w-16 text-gray-400 mx-auto mb-4"/>
          <h3 className="text-xl font-medium text-gray-300 mb-2">No perks found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm
                ? `No results for "${searchTerm}". Try adjusting your search.`
                : "No perks available in this category."}
          </p>
          <Button variant="outline" onClick={() => {
                setSearchTerm("");
                setActiveCategory("all");
            }}>
            Clear Filters
          </Button>
        </Card>)}
    </div>);
}
