
import { useState } from "react";
import { useMemo } from "react";
import type { UploadResult } from "@uppy/core";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Upload,
  Trash2,
  Plus,
  FileText,
  Calendar,
  Star,
  Copy,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

type SamplePlatform = "reddit" | "twitter" | "instagram";

interface SamplePost {
  id: number;
  userId: number;
  title: string;
  content: string;
  platform: SamplePlatform;
  subreddit?: string;
  upvotes?: number;
  imageUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface SampleForm {
  title: string;
  content: string;
  platform: SamplePlatform;
  subreddit: string;
  upvotes: number;
  imageUrl: string;
  tags: string[];
}

interface SamplePostResponse extends Omit<SamplePost, "platform" | "tags"> {
  platform?: string;
  tags?: unknown;
}

const EMPTY_FORM: SampleForm = {
  title: "",
  content: "",
  platform: "reddit",
  subreddit: "",
  upvotes: 0,
  imageUrl: "",
  tags: [],
};

function isSamplePlatform(value: unknown): value is SamplePlatform {
  return value === "reddit" || value === "twitter" || value === "instagram";
}

function normalizeSample(sample: SamplePostResponse): SamplePost {
  const tags = Array.isArray(sample.tags)
    ? sample.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  const platform = isSamplePlatform(sample.platform) ? sample.platform : "reddit";

  return {
    ...sample,
    tags,
    platform,
  };
}

export default function SampleUpload() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SamplePost | null>(null);
  const [formData, setFormData] = useState<SampleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const fetchSamples = useMemo(
    () =>
      async (): Promise<SamplePost[]> => {
        const response = await apiRequest("GET", "/api/sample-posts");
        const payload = (await response.json()) as SamplePostResponse[];
        return payload.map(normalizeSample);
      },
    [],
  );

  const {
    data: samples = [],
    isLoading,
    error: queryError,
  } = useQuery<SamplePost[], Error>({
    queryKey: ["/api/sample-posts"],
    queryFn: fetchSamples,
    retry: false,
    staleTime: 60_000,
  });

  const { mutate: deleteSample } = useMutation<unknown, Error, number>({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sample-posts/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/sample-posts"] });
      toast({
        title: "Sample deleted",
        description: "Sample post has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to delete sample",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addMutation = useMutation<unknown, Error, SampleForm>({
    mutationFn: async (data: SampleForm) => {
      await apiRequest("POST", "/api/sample-posts", data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/sample-posts"] });
      toast({
        title: "Sample added",
        description: "Your sample post has been saved.",
      });
      setShowAddForm(false);
      setFormData(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(error.message);
      toast({
        title: "Unable to add sample",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload");
    const { uploadURL } = (await response.json()) as { uploadURL: string };
    return { method: "PUT" as const, url: uploadURL };
  };

  const handleUploadComplete = (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>,
  ) => {
    const uploadedFile = result.successful?.find(
      (file): file is typeof file & { uploadURL: string } =>
        typeof file.uploadURL === "string" && file.uploadURL.length > 0,
    );

    if (uploadedFile) {
      setFormData((prev) => ({ ...prev, imageUrl: uploadedFile.uploadURL }));
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully.",
      });
    }
  };

  const handleNumberChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const ensurePlatform = (value: string): SamplePlatform =>
    isSamplePlatform(value) ? value : "reddit";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    addMutation.mutate({
      ...formData,
      platform: ensurePlatform(formData.platform),
      tags: Array.isArray(formData.tags) ? formData.tags : [],
    });
  };

  const handleCopyContent = async () => {
    if (!selectedSample) {
      return;
    }

    try {
      setIsCopying(true);
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not available in this environment.");
      }
      await navigator.clipboard.writeText(selectedSample.content);
      toast({
        title: "Copied!",
        description: "Content copied to clipboard.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to copy content.";
      toast({
        title: "Copy failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  const queryErrorMessage = queryError?.message ?? "Unable to load sample posts.";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Upload Sample Posts
          </h2>
          <p className="text-gray-400 mt-1">
            Upload your best performing posts to train the AI on your writing style
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm((previous) => !previous)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {showAddForm ? "Close" : "Add Sample"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">
                Post Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">
                Content
              </label>
              <textarea
                value={formData.content}
                onChange={(event) => setFormData({ ...formData, content: event.target.value })}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[150px]"
                required
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  Platform
                </label>
                <select
                  value={formData.platform}
                  onChange={(event) =>
                    setFormData({ ...formData, platform: ensurePlatform(event.target.value) })
                  }
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="reddit">Reddit</option>
                  <option value="twitter">Twitter</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  Subreddit (optional)
                </label>
                <input
                  type="text"
                  value={formData.subreddit}
                  onChange={(event) => setFormData({ ...formData, subreddit: event.target.value })}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">
                  Upvotes/Likes
                </label>
                <input
                  type="number"
                  value={formData.upvotes}
                  onChange={(event) =>
                    setFormData({ ...formData, upvotes: handleNumberChange(event.target.value) })
                  }
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">
                Upload Image (optional)
              </label>
              <ObjectUploader
                maxNumberOfFiles={1}
                maxFileSize={10485760}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="bg-gray-800/50 border border-gray-700 hover:bg-gray-700/50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </ObjectUploader>
              {formData.imageUrl && (
                <p className="text-sm text-green-400 mt-2">
                  <CheckCircle className="h-4 w-4 inline mr-1" />
                  Image uploaded successfully
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={addMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {addMutation.isPending ? "Adding..." : "Add Sample"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setFormData(EMPTY_FORM);
                  setFormError(null);
                }}
                className="border-gray-700 hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unable to save sample</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        </div>
      ) : queryError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load samples</AlertTitle>
          <AlertDescription>{queryErrorMessage}</AlertDescription>
        </Alert>
      ) : samples.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-12 text-center">
          <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 mb-6">
            Upload your best performing posts to help the AI learn your writing style
          </p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Sample
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {samples.map((sample) => (
            <Card
              key={sample.id}
              data-testid={`sample-card-${sample.id}`}
              className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6 hover:border-purple-700/50 transition-all cursor-pointer"
              onClick={() => setSelectedSample(sample)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-white line-clamp-1">{sample.title}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSample(sample.id);
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-gray-400 text-sm line-clamp-3 mb-4">{sample.content}</p>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(sample.createdAt).toLocaleDateString()}
                </span>
                {typeof sample.upvotes === "number" && sample.upvotes > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    <Star className="h-3 w-3" />
                    {sample.upvotes}
                  </span>
                )}
                <Badge variant="secondary" className="bg-purple-900/30 text-purple-300">
                  {sample.platform}
                </Badge>
              </div>

              {sample.imageUrl && (
                <div className="mt-4">
                  <img
                    src={sample.imageUrl}
                    alt={sample.title}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {selectedSample && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedSample(null)}
        >
          <Card
            className="bg-gray-900 border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-white">{selectedSample.title}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSample(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </Button>
              </div>

              {selectedSample.imageUrl && (
                <img
                  src={selectedSample.imageUrl}
                  alt={selectedSample.title}
                  className="w-full max-h-96 object-contain rounded-lg mb-6"
                />
              )}

              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-gray-300">{selectedSample.content}</p>
              </div>

              <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                <Badge variant="secondary" className="bg-purple-900/30 text-purple-300">
                  {selectedSample.platform}
                </Badge>
                {typeof selectedSample.upvotes === "number" && selectedSample.upvotes > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    <Star className="h-3 w-3" />
                    {selectedSample.upvotes}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(selectedSample.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  onClick={handleCopyContent}
                  disabled={isCopying}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {isCopying ? "Copying..." : "Copy Content"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
