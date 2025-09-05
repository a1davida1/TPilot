import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle
} from "lucide-react";

  id: number;
  userId: number;
  title: string;
  content: string;
  platform: string;
  subreddit?: string;
  upvotes?: number;
  imageUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    platform: "reddit",
    subreddit: "",
    upvotes: 0,
    imageUrl: "",
    tags: [] as string[]
  });

    retry: false
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
    },
    onSuccess: () => {
      toast({
      });
    },
    onError: () => {
      toast({
        title: "Error",
        variant: "destructive"
      });
    }
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
    },
    onSuccess: () => {
      toast({
      });
      setShowAddForm(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        variant: "destructive"
      });
    }
  });

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("/api/objects/upload", "POST") as unknown as { uploadURL: string };
    return {
      method: "PUT" as const,
      url: response.uploadURL
    };
  };

  const handleUploadComplete = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedUrl = result.successful[0].uploadURL;
      setFormData({ ...formData, imageUrl: response.objectPath });
      toast({
        title: "Image uploaded",
        description: "Your image has been uploaded successfully."
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      platform: "reddit",
      subreddit: "",
      upvotes: 0,
      imageUrl: "",
      tags: []
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          </h2>
          <p className="text-gray-400 mt-1">
            Upload your best performing posts to train the AI on your writing style
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <Plus className="h-4 w-4 mr-2" />
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
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, subreddit: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, upvotes: parseInt(e.target.value) || 0 })}
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
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="border-gray-700 hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        </div>
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
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card
              className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6 hover:border-purple-700/50 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-white line-clamp-1">
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-gray-400 text-sm line-clamp-3 mb-4">
              </p>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                </span>
                  <span className="flex items-center gap-1 text-green-400">
                    <Star className="h-3 w-3" />
                  </span>
                )}
                <Badge variant="secondary" className="bg-purple-900/30 text-purple-300">
                </Badge>
              </div>

                <div className="mt-4">
                  <img
                    className="w-full h-32 object-cover rounded-lg"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <Card
            className="bg-gray-900 border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-white">
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </Button>
              </div>

                <img
                  className="w-full max-h-96 object-contain rounded-lg mb-6"
                />
              )}

              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-gray-300">
                </p>
              </div>

              <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                <Badge variant="secondary" className="bg-purple-900/30 text-purple-300">
                </Badge>
                )}
                  <span className="flex items-center gap-1 text-green-400">
                    <Star className="h-3 w-3" />
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                </span>
              </div>

              <div className="mt-6 flex gap-3">
                <Button
                  onClick={() => {
                    toast({
                      title: "Copied!",
                      description: "Content copied to clipboard."
                    });
                  }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Content
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}