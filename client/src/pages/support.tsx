import { useState } from 'react';
import { HelpCircle, MessageCircle, Book, Mail, Video, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackWidget } from '@/components/FeedbackWidget';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'How do I connect my Reddit account?',
    answer: 'Go to Settings > Connections and click "Connect Reddit Account". You\'ll be redirected to Reddit to authorize ThottoPilot. Once approved, you can start posting!'
  },
  {
    category: 'Getting Started',
    question: 'What tier should I choose?',
    answer: 'Free tier is great for testing. Starter ($9) gives you basic features. Pro ($29) adds scheduling up to 7 days. Premium ($99) gives you everything including 30-day scheduling and unlimited posts.'
  },
  {
    category: 'Posting',
    question: 'Why was my post rejected?',
    answer: 'Posts can be rejected for violating subreddit rules, incorrect flair, or NSFW content in non-NSFW subs. Check the subreddit rules and our compliance checker.'
  },
  {
    category: 'Posting',
    question: 'How does scheduling work?',
    answer: 'Pro and Premium users can schedule posts in advance. We\'ll automatically post at your chosen time. Pro users can schedule up to 7 days ahead, Premium up to 30 days.'
  },
  {
    category: 'Billing',
    question: 'How do I cancel my subscription?',
    answer: 'Go to Settings > Billing and click "Cancel Subscription". You\'ll keep access until the end of your billing period.'
  },
  {
    category: 'Billing',
    question: 'Do you offer refunds?',
    answer: 'We offer a 7-day money-back guarantee for first-time subscribers. Contact support@thottopilot.com for refund requests.'
  },
  {
    category: 'Content',
    question: 'Where are my images stored?',
    answer: 'All images are uploaded to Imgur for legal compliance. We never store adult content on our servers. Your Imgur links are saved securely in our database.'
  },
  {
    category: 'Content',
    question: 'How does AI caption generation work?',
    answer: 'We use OpenRouter to access multiple AI models (Grok, OpenAI, Claude). Select your style and theme, and we\'ll generate captions tailored for your subreddit.'
  }
];

export function Support() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', ...new Set(faqs.map(faq => faq.category))];
  const filteredFAQs = selectedCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">How can we help?</h1>
        <p className="text-lg text-gray-600">Get support, read docs, or contact us</p>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Book className="h-12 w-12 mx-auto mb-3 text-purple-500" />
            <h3 className="font-semibold mb-1">Documentation</h3>
            <p className="text-sm text-gray-600">Read our guides</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Video className="h-12 w-12 mx-auto mb-3 text-blue-500" />
            <h3 className="font-semibold mb-1">Video Tutorials</h3>
            <p className="text-sm text-gray-600">Watch and learn</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <h3 className="font-semibold mb-1">Live Chat</h3>
            <p className="text-sm text-gray-600">Chat with support</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Mail className="h-12 w-12 mx-auto mb-3 text-pink-500" />
            <h3 className="font-semibold mb-1">Email Support</h3>
            <p className="text-sm text-gray-600">support@thottopilot.com</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="faq" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="contact">Contact Us</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        {/* FAQ Tab */}
        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>Find answers to common questions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Category Filter */}
              <div className="flex gap-2 mb-6 flex-wrap">
                {categories.map(category => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Button>
                ))}
              </div>

              {/* FAQ Items */}
              <div className="space-y-3">
                {filteredFAQs.map((faq, index) => (
                  <div
                    key={index}
                    className="border rounded-lg overflow-hidden"
                  >
                    <button
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
                      onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    >
                      <div className="flex items-start gap-3">
                        <HelpCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="font-medium">{faq.question}</div>
                          <div className="text-xs text-gray-500">{faq.category}</div>
                        </div>
                      </div>
                      {expandedFAQ === index ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    {expandedFAQ === index && (
                      <div className="px-4 py-3 bg-gray-50 border-t">
                        <p className="text-sm text-gray-700 pl-8">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact">
          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
              <CardDescription>We're here to help</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Response Times</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span>Email Support</span>
                    <span className="font-medium">24-48 hours</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span>Live Chat (Premium)</span>
                    <span className="font-medium">2-4 hours</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span>Priority Support (Premium)</span>
                    <span className="font-medium">Same day</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Contact Methods</h3>
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Mail className="mr-2 h-4 w-4" />
                    support@thottopilot.com
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Open Live Chat
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium mb-2">Premium Support Benefits</h4>
                <ul className="text-sm space-y-1">
                  <li>• Priority response times</li>
                  <li>• Direct access to senior support team</li>
                  <li>• Video call support available</li>
                  <li>• Custom onboarding session</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status Tab */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Current operational status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div>
                    <div className="font-medium">All Systems Operational</div>
                    <div className="text-sm text-gray-600">Last checked: Just now</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">API</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Reddit Integration</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">AI Generation</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm">Image Uploads</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-600">Operational</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">
                  For real-time updates, visit{' '}
                  <a href="#" className="text-purple-600 hover:underline">
                    status.thottopilot.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feedback Widget is already visible globally */}
    </div>
  );
}
