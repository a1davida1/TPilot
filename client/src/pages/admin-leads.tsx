import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Download, 
  Users, 
  CheckCircle, 
  Clock, 
  Filter,
  Mail,
  Calendar,
  Tag
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Lead {
  id: string;
  email: string;
  platformTags: string[];
  painPoint?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  confirmedAt?: string;
  createdAt: string;
}

interface LeadsStats {
  totalLeads: number;
  confirmedLeads: number;
  pendingLeads: number;
  conversionRate: number;
}

export function AdminLeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending'>('all');
  
  // Fetch leads data
  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/admin/leads'],
  });

  const stats: LeadsStats = {
    totalLeads: leads.length,
    confirmedLeads: leads.filter(lead => lead.confirmedAt).length,
    pendingLeads: leads.filter(lead => !lead.confirmedAt).length,
    conversionRate: leads.length > 0 ? (leads.filter(lead => lead.confirmedAt).length / leads.length) * 100 : 0
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.painPoint?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'confirmed' && lead.confirmedAt) ||
      (statusFilter === 'pending' && !lead.confirmedAt);
    
    return matchesSearch && matchesStatus;
  });

  const downloadCSV = () => {
    if (leads.length === 0) return;

    const headers = [
      'Email',
      'Platforms',
      'Pain Point',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'UTM Content',
      'UTM Term',
      'Referrer',
      'Status',
      'Created At',
      'Confirmed At'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => [
        lead.email,
        lead.platformTags.join(';'),
        lead.painPoint || '',
        lead.utmSource || '',
        lead.utmMedium || '',
        lead.utmCampaign || '',
        lead.utmContent || '',
        lead.utmTerm || '',
        lead.referrer || '',
        lead.confirmedAt ? 'Confirmed' : 'Pending',
        lead.createdAt,
        lead.confirmedAt || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thottopilot-leads-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      reddit: 'bg-orange-100 text-orange-800',
      x: 'bg-black text-white',
      onlyfans: 'bg-blue-100 text-blue-800',
      fansly: 'bg-purple-100 text-purple-800'
    };
    return colors[platform] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Waitlist Leads</h1>
          <Button onClick={downloadCSV} className="flex items-center">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.confirmedLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.pendingLeads}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="px-6 py-4 font-medium">Lead</th>
                    <th className="px-6 py-4 font-medium">Platforms</th>
                    <th className="px-6 py-4 font-medium">Pain Point</th>
                    <th className="px-6 py-4 font-medium">UTM Source</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Mail className="mr-2 h-4 w-4 text-gray-400" />
                          <span className="font-medium">{lead.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {lead.platformTags.map((platform) => (
                            <Badge
                              key={platform}
                              variant="secondary"
                              className={getPlatformColor(platform)}
                            >
                              {platform}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-sm text-gray-600 truncate" title={lead.painPoint}>
                          {lead.painPoint || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {lead.utmSource || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {lead.confirmedAt ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Confirmed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="flex items-center text-gray-600">
                            <Calendar className="mr-1 h-3 w-3" />
                            {formatDate(lead.createdAt)}
                          </div>
                          {lead.confirmedAt && (
                            <div className="text-xs text-green-600 mt-1">
                              Confirmed: {formatDate(lead.confirmedAt)}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredLeads.length === 0 && (
              <div className="text-center py-12">
                <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                <p className="text-gray-500">
                  {searchQuery || statusFilter !== 'all' 
                    ? "Try adjusting your filters" 
                    : "No leads have been captured yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}