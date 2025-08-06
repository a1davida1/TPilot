import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  FileText, 
  Gift, 
  Shield, 
  DollarSign,
  Download,
  BookOpen,
  Tag,
  Percent,
  Calculator,
  Lock,
  Star,
  TrendingUp,
  Users,
  Heart,
  Sparkles,
  CheckCircle,
  ExternalLink,
  Copy,
  Search,
  Filter,
  Crown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'pdf' | 'ebook' | 'coupon' | 'discount' | 'service';
  value?: string;
  downloadUrl?: string;
  externalUrl?: string;
  isPremium?: boolean;
  savedAmount?: string;
  validUntil?: string;
  rating?: number;
  downloads?: number;
}

export function ProPerks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const { toast } = useToast();

  // Sample resources - in production these would come from an API
  const resources: Resource[] = [
    // PDFs & Ebooks
    {
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

  const handleDownload = (resource: Resource) => {
    toast({
      title: "Download Started",
      description: `${resource.title} is being downloaded...`
    });
  };

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Coupon Copied!",
      description: `Code "${code}" copied to clipboard`
    });
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-5 w-5" />;
      case 'ebook': return <BookOpen className="h-5 w-5" />;
      case 'coupon': return <Tag className="h-5 w-5" />;
      case 'discount': return <Percent className="h-5 w-5" />;
      case 'service': return <Users className="h-5 w-5" />;
      default: return <Gift className="h-5 w-5" />;
    }
  };

  const getResourceBadge = (type: string) => {
    const badges = {
      pdf: 'PDF',
      ebook: 'Ebook',
      coupon: 'Coupon',
      discount: 'Discount',
      service: 'Service'
    };
    return badges[type as keyof typeof badges] || type;
  };

  return (
    <div className="space-y-6">
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search perks, guides, and discounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900/50 border-purple-500/20"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category.id)}
              className={activeCategory === category.id 
                ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0"
                : "border-purple-500/30 hover:bg-purple-500/10"
              }
            >
              <Icon className="h-4 w-4 mr-2" />
              {category.label}
            </Button>
          );
        })}
      </div>

      {/* Resources Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredResources.map((resource) => (
          <Card key={resource.id} className="bg-gray-900/50 border-purple-500/20 hover:border-purple-500/40 transition-all">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    {getResourceIcon(resource.type)}
                  </div>
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                    {getResourceBadge(resource.type)}
                  </Badge>
                </div>
                {resource.isPremium && (
                  <Crown className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              <CardTitle className="text-lg mt-3">{resource.title}</CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                {resource.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Metadata */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                {resource.downloads && (
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {resource.downloads.toLocaleString()} downloads
                  </div>
                )}
                {resource.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    {resource.rating}
                  </div>
                )}
                {resource.savedAmount && (
                  <div className="flex items-center gap-1 text-green-400">
                    <DollarSign className="h-3 w-3" />
                    Save {resource.savedAmount}
                  </div>
                )}
                {resource.validUntil && (
                  <div className="text-orange-400">
                    Valid until {new Date(resource.validUntil).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Coupon Code */}
              {resource.value && (
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg">
                  <code className="flex-1 text-purple-300 font-mono">{resource.value}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyCoupon(resource.value!)}
                    className="text-purple-400 hover:text-purple-300"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {resource.downloadUrl !== undefined ? (
                  <Button 
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                    size="sm"
                    onClick={() => handleDownload(resource)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                ) : resource.externalUrl ? (
                  <Button 
                    className="flex-1"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(resource.externalUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visit Site
                  </Button>
                ) : resource.type === 'service' ? (
                  <Button 
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Claim Now
                  </Button>
                ) : (
                  <Button 
                    className="flex-1"
                    variant="outline"
                    size="sm"
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    Coming Soon
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats Section */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Total Savings</p>
                <p className="text-2xl font-bold text-green-400">$1,247</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Resources Used</p>
                <p className="text-2xl font-bold text-purple-400">23</p>
              </div>
              <FileText className="h-8 w-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Active Discounts</p>
                <p className="text-2xl font-bold text-pink-400">8</p>
              </div>
              <Tag className="h-8 w-8 text-pink-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">New This Month</p>
                <p className="text-2xl font-bold text-orange-400">5</p>
              </div>
              <Sparkles className="h-8 w-8 text-orange-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}