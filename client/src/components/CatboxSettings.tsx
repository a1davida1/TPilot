import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Save, 
  ExternalLink, 
  Shield, 
  Trash2,
  Info,
  CheckCircle,
  AlertCircle,
  BarChart
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadStats {
  totalUploads: number;
  totalSize: number;
  successRate: number;
  averageDuration: number;
}

export function CatboxSettings() {
  const [userhash, setUserhash] = useState('');
  const [savedHash, setSavedHash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState<UploadStats | null>(null);
  const { toast } = useToast();

  // Load current hash and stats
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Get user's Catbox hash
      const hashResponse = await fetch('/api/catbox/hash', {
        credentials: 'include'
      });
      
      if (hashResponse.ok) {
        const data = await hashResponse.json();
        if (data.hash) {
          setUserhash(data.hash);
          setSavedHash(data.hash);
          // Store in localStorage for use in uploads
          localStorage.setItem('catbox_userhash', data.hash);
        }
      }

      // Get upload statistics
      const statsResponse = await fetch('/api/catbox/stats', {
        credentials: 'include'
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (_error) {
      // Settings failed to load silently
    } finally {
      setIsLoading(false);
    }
  };

  const saveHash = async () => {
    if (!userhash.trim()) {
      toast({
        title: "Invalid hash",
        description: "Please enter your Catbox user hash",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/catbox/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: userhash.trim() }),
        credentials: 'include'
      });

      if (response.ok) {
        setSavedHash(userhash);
        // Store in localStorage for use in uploads
        localStorage.setItem('catbox_userhash', userhash);
        toast({
          title: "Settings saved",
          description: "Your Catbox hash has been saved successfully"
        });
      } else {
        throw new Error('Failed to save hash');
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const removeHash = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/catbox/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: '' }),
        credentials: 'include'
      });

      if (response.ok) {
        setUserhash('');
        setSavedHash('');
        // Clear from localStorage
        localStorage.removeItem('catbox_userhash');
        toast({
          title: "Hash removed",
          description: "Your Catbox hash has been removed"
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to remove hash",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Catbox Settings</CardTitle>
        <CardDescription>
          Configure your Catbox account for authenticated uploads and file management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Status */}
        <div className="flex items-center gap-2">
          {savedHash ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">Authenticated</span>
              <Badge variant="outline" className="ml-2">Premium Features Enabled</Badge>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium">Anonymous Mode</span>
              <Badge variant="outline" className="ml-2">Basic Features Only</Badge>
            </>
          )}
        </div>

        <Separator />

        {/* User Hash Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userhash">Catbox User Hash</Label>
            <div className="flex gap-2">
              <Input
                id="userhash"
                type="password"
                value={userhash}
                onChange={(e) => setUserhash(e.target.value)}
                placeholder="Enter your Catbox user hash"
                disabled={isLoading || isSaving}
              />
              <Button
                onClick={saveHash}
                disabled={isLoading || isSaving || userhash === savedHash}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              {savedHash && (
                <Button
                  onClick={removeHash}
                  disabled={isSaving}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your user hash allows you to manage and delete uploaded files
            </p>
          </div>

          {/* How to get hash */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>How to get your Catbox user hash:</strong>
              <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
                <li>Create a free account at <a href="https://catbox.moe" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">catbox.moe</a></li>
                <li>Go to your account settings</li>
                <li>Find your "User Hash" in the API section</li>
                <li>Copy and paste it here</li>
              </ol>
            </AlertDescription>
          </Alert>
        </div>

        <Separator />

        {/* Features Comparison */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Features</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Anonymous (Current)</h4>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Upload files up to 200MB
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Files stay forever
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-gray-400" />
                  Cannot delete files
                </li>
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-gray-400" />
                  No album support
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-primary">Authenticated</h4>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Upload files up to 200MB
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Delete your uploads
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Create & manage albums
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Upload history tracking
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Upload Statistics */}
        {stats && stats.totalUploads > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                Upload Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Uploads</p>
                  <p className="text-lg font-semibold">{stats.totalUploads}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-lg font-semibold">{formatBytes(stats.totalSize)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-lg font-semibold">{stats.successRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Duration</p>
                  <p className="text-lg font-semibold">{formatDuration(stats.averageDuration)}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* External Links */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href="https://catbox.moe" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Catbox.moe
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <a href="https://catbox.moe/user/api.php" target="_blank" rel="noopener noreferrer">
              <Shield className="h-4 w-4 mr-2" />
              API Documentation
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
