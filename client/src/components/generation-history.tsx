import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Copy, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ContentGeneration {
  id: number;
  platform: string;
  style: string;
  theme: string;
  titles: string[];
  content: string;
  photoInstructions: unknown;
  prompt: string;
  createdAt: string;
  allowsPromotion: boolean;
}

interface GenerationHistoryProps {
  onSelectGeneration?: (generation: ContentGeneration) => void;
}

export function GenerationHistory({ onSelectGeneration }: GenerationHistoryProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: history = [], isLoading } = useQuery<ContentGeneration[]>({
    queryKey: ["/api/content-generation-history"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const copyToClipboard = async (text: string, itemName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemName);
      toast({
        description: `${itemName} copied to clipboard`,
      });
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try selecting and copying manually",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No content generated yet</p>
        <p className="text-sm">Your generation history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center">
          <Clock className="mr-2 h-5 w-5 text-primary" />
          Generation History
        </h3>
        <Badge variant="secondary">{history.length} generations</Badge>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {history.map((generation) => (
          <div
            key={generation.id}
            className="border rounded-lg p-4 space-y-3 hover:bg-secondary/50 transition-colors cursor-pointer"
            onClick={() => onSelectGeneration?.(generation)}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {generation.platform}
                </Badge>
                {generation.style && (
                  <Badge variant="secondary" className="text-xs">
                    {generation.style}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(generation.createdAt)}
              </span>
            </div>

            {/* Titles */}
            {generation.titles && generation.titles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Titles:</p>
                {generation.titles.slice(0, 2).map((title, index) => (
                  <div key={index} className="relative group">
                    <p className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded text-ellipsis overflow-hidden">
                      {title.length > 80 ? `${title.substring(0, 80)}...` : title}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(title, `History Title ${generation.id}-${index}`);
                      }}
                      className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedItem === `History Title ${generation.id}-${index}` ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
                {generation.titles.length > 2 && (
                  <p className="text-xs text-muted-foreground">
                    +{generation.titles.length - 2} more titles
                  </p>
                )}
              </div>
            )}

            {/* Content Preview */}
            {generation.content && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Content:</p>
                <div className="relative group">
                  <p className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded">
                    {generation.content.length > 120 
                      ? `${generation.content.substring(0, 120)}...` 
                      : generation.content}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(generation.content, `History Content ${generation.id}`);
                    }}
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedItem === `History Content ${generation.id}` ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Prompt */}
            {generation.prompt && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Prompt:</span> {generation.prompt.substring(0, 60)}
                  {generation.prompt.length > 60 && '...'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}