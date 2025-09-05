import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { safeArray, safeString } from "@/utils/safeDataAccess";

interface ProviderInfo {
  name: string;
  status: 'available' | 'unavailable' | 'quota_exceeded';
  inputCost: string;
  outputCost: string;
  savings: string;
  description: string;
}

export function ProviderStatus() {
  const { data: providers, isLoading, refetch } = useQuery({
    queryKey: ["/api/providers"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'quota_exceeded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'quota_exceeded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unavailable':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>Loading provider information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Service Status & Cost Savings
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription>
          Real-time monitoring of AI providers and cost optimization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {safeArray(providers, []).map((provider: any, index: number) => {
            // Safe provider data extraction
            const providerName = safeString(provider?.name, `Provider ${index + 1}`);
            const providerDescription = safeString(provider?.description, 'AI content generation provider');
            const providerStatus = provider?.status || 'unknown';
            const inputCost = safeString(provider?.inputCost, 'N/A');
            const outputCost = safeString(provider?.outputCost, 'N/A');
            const savings = safeString(provider?.savings, '0%');
            
            return (
              <div key={providerName + index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(providerStatus)}
                  <div>
                    <h4 className="font-medium">{providerName}</h4>
                    <p className="text-sm text-gray-600">{providerDescription}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Input: {inputCost} | Output: {outputCost}
                    </div>
                    <div className="text-xs text-green-600 font-medium">
                      {savings} vs OpenAI
                    </div>
                  </div>
                  <Badge className={getStatusColor(providerStatus)}>
                    {String(providerStatus).replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            );
          })}
          
          {safeArray(providers, []).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="mx-auto h-12 w-12 mb-4" />
              <p>Provider status information unavailable</p>
              <p className="text-sm">Add ANTHROPIC_API_KEY and GEMINI_API_KEY to unlock 75-98% cost savings</p>
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">💡 Cost Optimization Tips</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Gemini Flash offers 98% savings ($0.075 vs $5.00 per 1M tokens)</li>
              <li>• Claude Haiku provides 75% savings with excellent quality</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}