import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Sparkles,
} from "lucide-react";

type QuickStartStep = "connect" | "subreddit" | "copy" | "confirm";

interface QuickStartTemplate {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  isNsfw: boolean;
  description: string;
}

interface QuickStartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep: QuickStartStep;
  isRedditConnected?: boolean;
  onNavigate?: () => void;
  onConnected?: () => void;
  onSelectedCommunity?: () => void;
  onPosted?: () => void;
}

interface RedditConnectResponse {
  authUrl?: string;
  message?: string;
}

interface RedditSubmitResponse {
  success?: boolean;
  error?: string;
}

interface RedditAccount {
  id: number;
  username: string;
  isActive: boolean;
  connectedAt: string;
  karma: number;
  verified: boolean;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

function isRedditAccountList(value: unknown): value is RedditAccount[] {
  return (
    Array.isArray(value) &&
    value.every((account) => {
      if (account === null || typeof account !== "object") {
        return false;
      }
      const candidate = account as Partial<RedditAccount>;
      return typeof candidate.id === "number" && typeof candidate.username === "string";
    })
  );
}

const QUICK_START_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "gonewild",
    subreddit: "gonewild",
    title: "Feeling cute today [F]",
    body: "Hope you enjoy! More content on my profile 💕",
    isNsfw: true,
    description: "High engagement NSFW community for confident self portraits.",
  },
  {
    id: "onlyfans101",
    subreddit: "onlyfans101",
    title: "New content just dropped! 🔥",
    body: "Check out my latest photos and videos! Link in bio 💋",
    isNsfw: true,
    description: "Promote new drops and drive traffic back to your subscription links.",
  },
  {
    id: "selfie",
    subreddit: "selfie",
    title: "Good vibes only ✨",
    body: "Having a great day! How is everyone doing?",
    isNsfw: false,
    description: "Safe-for-work audience with consistent daily engagement.",
  },
];

const QUICK_START_STEPS: QuickStartStep[] = [
  "connect",
  "subreddit",
  "copy",
  "confirm",
];

const STEP_DETAILS: Record<QuickStartStep, { title: string; description: string }> = {
  connect: {
    title: "Connect Reddit",
    description: "Authorize posting access",
  },
  subreddit: {
    title: "Choose subreddit",
    description: "Match the right community",
  },
  copy: {
    title: "Generate copy",
    description: "Craft an engaging story",
  },
  confirm: {
    title: "Confirm & schedule",
    description: "Review before publishing",
  },
};

function getTemplateById(id: string | undefined): QuickStartTemplate | undefined {
  return QUICK_START_TEMPLATES.find((template) => template.id === id);
}

export function QuickStartModal({
  open,
  onOpenChange,
  initialStep,
  isRedditConnected = false,
  onNavigate: _onNavigate,
  onConnected,
  onSelectedCommunity,
  onPosted,
}: QuickStartModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<QuickStartStep>(initialStep);
  const [connected, setConnected] = useState<boolean>(isRedditConnected);
  const [connectionInitiated, setConnectionInitiated] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionCompletedRef = useRef(false);

  const clearConnectionMonitors = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      clearConnectionMonitors();
      setConnectionInitiated(false);
      setIsConnecting(false);
      return;
    }
    setCurrentStep(initialStep);
    setSubmitError(null);
    setIsSubmitting(false);
    setConnectionInitiated(false);
  }, [open, initialStep, clearConnectionMonitors]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (connectionInitiated) {
      return;
    }
    setConnected(isRedditConnected);
  }, [isRedditConnected, connectionInitiated, open]);

  useEffect(() => () => {
    clearConnectionMonitors();
  }, [clearConnectionMonitors]);


  // Initialize default template separately to avoid step reset
  useEffect(() => {
    if (open && QUICK_START_TEMPLATES.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(QUICK_START_TEMPLATES[0].id);
      setPostTitle(QUICK_START_TEMPLATES[0].title);
      setPostBody(QUICK_START_TEMPLATES[0].body);
    }
  }, [open, selectedTemplateId]);

  const selectedTemplate = useMemo(() => getTemplateById(selectedTemplateId), [selectedTemplateId]);

  const currentStepIndex = QUICK_START_STEPS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === QUICK_START_STEPS.length - 1;

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "connect":
        return connected;
      case "subreddit":
        return selectedTemplateId !== "";
      case "copy":
        return postTitle.trim() !== "" && postBody.trim() !== "";
      case "confirm":
        return true;
      default:
        return false;
    }
  }, [currentStep, connected, selectedTemplateId, postTitle, postBody]);

  const handleConnect = async () => {
    if (connected || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setConnectionInitiated(true);
    connectionCompletedRef.current = false;

    const finishConnection = () => {
      if (connectionCompletedRef.current) {
        return true;
      }
      connectionCompletedRef.current = true;
      clearConnectionMonitors();
      setConnected(true);
      setIsConnecting(false);
      setConnectionInitiated(false);
      onConnected?.();
      return true;
    };

    const checkForAccount = async (): Promise<boolean> => {
      if (connectionCompletedRef.current) {
        return false;
      }
      try {
        const response = await apiRequest("GET", "/api/reddit/accounts");
        const data = (await response.json()) as unknown;
        if (isRedditAccountList(data) && data.length > 0) {
          return finishConnection();
        }
      } catch (pollError) {
        console.error("Reddit account poll failed", pollError);
      }
      return false;
    };

    try {
      const response = await apiRequest("GET", "/api/reddit/connect?intent=posting&queue=quick-start");
      const data = await response.json() as RedditConnectResponse;


      if (data.authUrl) {
        window.open(data.authUrl, "_blank");
        toast({
          title: "Reddit Authorization",
          description: "Complete the authorization in the new window, then return here.",
        });

        clearConnectionMonitors();

        const initialCheckSucceeded = await checkForAccount();
        if (initialCheckSucceeded) {
          return;
        }

        pollIntervalRef.current = setInterval(() => {
          void checkForAccount();
        }, POLL_INTERVAL_MS);

        pollTimeoutRef.current = setTimeout(() => {
          connectionCompletedRef.current = true;
          clearConnectionMonitors();
          setIsConnecting(false);
          setConnectionInitiated(false);
          toast({
            title: "Connection Timeout",
            description: "We couldn't verify your Reddit connection. Please try again.",
            variant: "destructive",
          });
        }, POLL_TIMEOUT_MS);
      } else {
        throw new Error(data.message || "Failed to get authorization URL");
      }
    } catch (_error) {
      clearConnectionMonitors();
      setIsConnecting(false);
      setConnectionInitiated(false);
      toast({
        title: "Connection Error",
        description: error instanceof Error ? error.message : "Failed to connect to Reddit",
        variant: "destructive",
      });
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      return;
    }

    // Report milestone completion before moving to next step
    if (currentStep === 'subreddit' && selectedTemplateId) {
      onSelectedCommunity?.();
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < QUICK_START_STEPS.length) {
      setCurrentStep(QUICK_START_STEPS[nextIndex]);
    }
  };

  const handlePrevious = () => {
    if (isFirstStep) {
      return;
    }

    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(QUICK_START_STEPS[prevIndex]);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = getTemplateById(templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setPostTitle(template.title);
      setPostBody(template.body);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await apiRequest("POST", "/api/reddit/submit", {
        subreddit: selectedTemplate.subreddit,
        title: postTitle,
        body: postBody,
        nsfw: selectedTemplate.isNsfw,
      });

      const data = await response.json() as RedditSubmitResponse;

      if (data.success) {
        toast({
          title: "Post Submitted!",
          description: "Your Reddit post has been published successfully.",
        });
        onPosted?.();
        onOpenChange(false);
      } else {
        throw new Error(data.error || "Failed to submit post");
      }
    } catch (_error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit post";
      setSubmitError(errorMessage);
      toast({
        title: "Submission Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "connect":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect your Reddit account</h3>
              <p className="text-gray-600 text-sm">
                Authorize ThottoPilot to post on your behalf
              </p>
            </div>

            {connected ? (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">Reddit account connected!</span>
                </CardContent>
              </Card>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connected || isConnecting}
                className={cn(
                  "w-full",
                  connected ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : connected ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Connected to Reddit
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Connect Reddit
                  </>
                )}
              </Button>
            )}
          </div>
        );

      case "subreddit":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Choose a subreddit</h3>
              <p className="text-gray-600 text-sm">
                Select a community template to get started
              </p>
            </div>

            <div className="grid gap-3">
              {QUICK_START_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedTemplateId === template.id
                      ? "ring-2 ring-purple-500 bg-purple-50"
                      : "hover:bg-gray-50"
                  )}
                  onClick={() => handleTemplateSelect(template.id)}
                  data-testid={`template-${template.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">r/{template.subreddit}</h4>
                      {template.isNsfw && (
                        <Badge variant="destructive" className="text-xs">NSFW</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <p className="text-xs text-gray-500 italic">"{template.title}"</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case "copy":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Generate your copy</h3>
              <p className="text-gray-600 text-sm">
                Customize your post title and description
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="post-title">Post Title</Label>
                <Input
                  id="post-title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="Enter your post title..."
                  data-testid="post-title-input"
                />
              </div>

              <div>
                <Label htmlFor="post-body">Post Body</Label>
                <Textarea
                  id="post-body"
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Write your post content..."
                  rows={4}
                  data-testid="post-body-input"
                />
              </div>

              {selectedTemplate && (
                <Card className="bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">Posting to:</span>
                      <Badge variant="outline">r/{selectedTemplate.subreddit}</Badge>
                      {selectedTemplate.isNsfw && (
                        <Badge variant="destructive" className="text-xs">NSFW</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Confirm your Reddit post</h3>
              <p className="text-gray-600 text-sm">
                Review your post before publishing
              </p>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">r/{selectedTemplate?.subreddit}</CardTitle>
                  {selectedTemplate?.isNsfw && (
                    <Badge variant="destructive" className="text-xs">NSFW</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <h4 className="font-semibold mb-2">{postTitle}</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{postBody}</p>
              </CardContent>
            </Card>

            {submitError && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4">
                  <p className="text-red-800 text-sm">{submitError}</p>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700"
              data-testid="confirm-post-button"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                "Confirm & post"
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="quick-start-dialog">
        <DialogHeader>
          <DialogTitle>Quick Start</DialogTitle>
          <DialogDescription>
            {STEP_DETAILS[currentStep].description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicators */}
        <div className="flex items-center justify-between mb-6">
          {QUICK_START_STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  index <= currentStepIndex
                    ? "bg-purple-600 text-white"
                    : "bg-gray-200 text-gray-600"
                )}
              >
                {index + 1}
              </div>
              {index < QUICK_START_STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-16 h-0.5 mx-2",
                    index < currentStepIndex ? "bg-purple-600" : "bg-gray-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {renderStepContent()}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep}
            data-testid="previous-button"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {!isLastStep && (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              data-testid="continue-button"
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}