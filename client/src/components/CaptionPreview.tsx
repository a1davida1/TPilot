import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";
import type { CaptionObject, RankedResult, CaptionPreviewData } from '@shared/types/caption';

// Re-export types from shared module for backward compatibility
export type { CaptionObject, RankedResult, CaptionPreviewData } from '@shared/types/caption';

export function CaptionPreview({ data }: { data: CaptionPreviewData | null | undefined }) {
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);


  if (!data) return null;
  
  const { final = '', ranked = [] } = data || {};
  if (!final) return null;
  
  // Handle different data formats - final could be a string or object with caption property
  const captionText = typeof final === 'string' ? final : final.caption;
  const charCount = captionText ? captionText.length : 0;
  
  if (!captionText) return null;

  const handleCopyCaption = async () => {
    await navigator.clipboard.writeText(captionText);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyJSON = async () => {
    await navigator.clipboard.writeText(JSON.stringify(final, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  return (
    <Card className="rounded-2xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Caption Preview</CardTitle>
          <Badge variant="outline" className="font-mono">
            {charCount} chars
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Caption */}
        <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {captionText}
          </p>
        </div>

        {/* ALT Text */}
        {typeof final === 'object' && final.alt && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">ALT Text</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded">
              {final.alt}
            </p>
          </div>
        )}

        {/* Hashtags */}
        {typeof final === 'object' && final.hashtags && final.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {final.hashtags.map((h: string, index: number) => (
              <Badge 
                key={`${h}-${index}`} 
                variant="secondary" 
                className="text-xs bg-gradient-to-r from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30"
              >
                {h}
              </Badge>
            ))}
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Mood</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{typeof final === 'object' && final.mood || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Style</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{typeof final === 'object' && final.style || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">CTA</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{typeof final === 'object' && final.cta || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Safety Level</p>
            <Badge 
              variant={typeof final === 'object' && final.safety_level === 'normal' ? 'default' : typeof final === 'object' && final.safety_level === 'spicy_safe' ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {typeof final === 'object' && final.safety_level || 'Generated'}
            </Badge>
          </div>
        </div>

        {/* AI Selection Reason */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Why this caption won</p>
              <p className="text-xs text-blue-600 dark:text-blue-300">{typeof ranked === 'object' && ranked && !Array.isArray(ranked) && 'reason' in ranked ? ranked.reason : 'Based on engagement optimization'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleCopyCaption}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {copiedCaption ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Caption
              </>
            )}
          </Button>
          <Button
            onClick={handleCopyJSON}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            {copiedJSON ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy JSON
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}