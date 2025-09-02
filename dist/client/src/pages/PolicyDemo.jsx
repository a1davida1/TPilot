import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PolicyPreview } from '@/components/PolicyPreview';
import { Shield, BookOpen, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
const DEMO_SUBREDDITS = [
    'gonewild',
    'realgirls',
    'selfie',
    'amihot',
    'rateme',
    'freecompliments'
];
export default function PolicyDemo() {
    const [subreddit, setSubreddit] = useState('gonewild');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [hasLink, setHasLink] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const handlePolicyPreviewComplete = (result) => {
        // Policy result handled internally by preview component
    };
    // Demo content examples
    const demoExamples = {
        clean: {
            title: '[F] Feeling confident in my new dress!',
            body: 'Had a great day today and wanted to share some positive vibes with you all. Hope everyone is having a wonderful week!'
        },
        warning: {
            title: 'Check out my selfie',
            body: 'Hi there! Short message.'
        },
        blocked: {
            title: 'CLICK HERE FOR FREE CONTENT!!!',
            body: 'Check out this banned content with forbidden words and spam patterns!'
        }
    };
    const loadExample = (type) => {
        const example = demoExamples[type];
        setTitle(example.title);
        setBody(example.body);
        setHasLink(type === 'blocked');
        setShowPreview(true);
    };
    return (<div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="policy-demo-page">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-blue-500"/>
          <h1 className="text-3xl font-bold">Policy Linter & Preview Gate Demo</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Test our content safety system that checks posts against subreddit rules and enforces 
          preview requirements before allowing content to be queued for posting.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Content Composer */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-500"/>
              <CardTitle>Content Composer</CardTitle>
            </div>
            <CardDescription>
              Create content and test it against our policy engine
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Subreddit Selection */}
            <div className="space-y-2">
              <Label htmlFor="subreddit-select">Target Subreddit</Label>
              <Select value={subreddit} onValueChange={setSubreddit}>
                <SelectTrigger id="subreddit-select" data-testid="select-subreddit">
                  <SelectValue placeholder="Select subreddit"/>
                </SelectTrigger>
                <SelectContent>
                  {DEMO_SUBREDDITS.map(sub => (<SelectItem key={sub} value={sub}>r/{sub}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* Title Input */}
            <div className="space-y-2">
              <Label htmlFor="title-input">Post Title</Label>
              <Input id="title-input" placeholder="Enter your post title..." value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-title"/>
            </div>

            {/* Body Input */}
            <div className="space-y-2">
              <Label htmlFor="body-input">Post Body (optional)</Label>
              <Textarea id="body-input" placeholder="Enter your post content..." value={body} onChange={(e) => setBody(e.target.value)} rows={4} data-testid="input-body"/>
            </div>

            {/* Has Link Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox id="has-link" checked={hasLink} onCheckedChange={(checked) => setHasLink(checked)} data-testid="checkbox-has-link"/>
              <Label htmlFor="has-link">Content includes promotional links</Label>
            </div>

            {/* Show Preview Button */}
            <Button onClick={() => setShowPreview(true)} disabled={!title.trim() || !subreddit} className="w-full" data-testid="button-show-preview">
              Check Content Policy
            </Button>

            {/* Demo Examples */}
            <div className="pt-4 border-t space-y-2">
              <Label className="text-sm font-medium">Quick Examples:</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => loadExample('clean')} className="text-green-600" data-testid="button-example-clean">
                  Clean Content
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadExample('warning')} className="text-yellow-600" data-testid="button-example-warning">
                  With Warnings
                </Button>
                <Button variant="outline" size="sm" onClick={() => loadExample('blocked')} className="text-red-600" data-testid="button-example-blocked">
                  Blocked Content
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Preview */}
        <div className="space-y-6">
          {showPreview && title && subreddit && (<PolicyPreview subreddit={subreddit} title={title} body={body} hasLink={hasLink} onPreviewComplete={handlePolicyPreviewComplete}/>)}

          {/* Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500"/>
                <CardTitle>How It Works</CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">🔍 Policy Linter</h4>
                <p className="text-muted-foreground">
                  Real-time content checking against subreddit-specific rules including 
                  banned words, spam patterns, length limits, and required tags.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">🚧 Preview Gate</h4>
                <p className="text-muted-foreground">
                  Users must have ≥3 "OK" previews in the last 14 days before 
                  they can queue posts for submission.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">🛡️ Server-Side Enforcement</h4>
                <p className="text-muted-foreground">
                  All policy checks are enforced server-side to prevent bypassing 
                  and ensure content safety compliance.
                </p>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground">
                <p><strong>Demo Rules:</strong> Each subreddit has customized rules for content safety. 
                Try different subreddits to see how rules adapt.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>);
}
