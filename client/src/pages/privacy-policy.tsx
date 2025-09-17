import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-100 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-yellow-400/5 opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,192,203,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,235,59,0.05),transparent_50%)]"></div>
      </div>

      <div className="relative container mx-auto px-4 py-8 max-w-4xl z-10">
        {/* Back Button */}
        <Link href="/">
          <Button
            variant="ghost"
            className="mb-6 hover:bg-white/50 dark:hover:bg-gray-800/50"
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        {/* Privacy Policy Content */}
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-pink-200/30 dark:border-purple-700/30 shadow-xl p-8">
          <div className="prose prose-pink dark:prose-invert max-w-none">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">
              Privacy Policy for ThottoPilot
            </h1>
            
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-8">
              <p><strong>Effective Date:</strong> February 14, 2025</p>
              <p><strong>Last Updated:</strong> February 14, 2025</p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Welcome to ThottoPilot ("we," "our," or "us"). We are committed to protecting your privacy and being transparent about how we collect, use, and protect your information. This Privacy Policy explains our practices regarding the personal information we collect from users of our AI-powered content creation platform.
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                By using ThottoPilot, you consent to the collection and use of your information as described in this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2.1 Personal Information</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Account information (email address, username, password)</li>
                <li>Profile information you choose to provide</li>
                <li>Billing information (processed securely through Stripe)</li>
                <li>Communication records when you contact us</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2.2 Content and Usage Data</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Content you create, upload, or generate using our platform</li>
                <li>Images and media files you upload for processing</li>
                <li>AI generation prompts and preferences</li>
                <li>Platform usage patterns and feature interactions</li>
                <li>Expense tracking data and receipt images</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">2.3 Technical Information</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Cookies and similar tracking technologies</li>
                <li>Error logs and performance data</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3.1 Service Provision</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Provide and maintain our AI content generation services</li>
                <li>Process your content generation requests</li>
                <li>Apply image protection and watermarking</li>
                <li>Manage your account and subscriptions</li>
                <li>Process payments and billing</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3.2 Platform Improvement</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Analyze usage patterns to improve our services</li>
                <li>Train and improve our AI models</li>
                <li>Develop new features and functionality</li>
                <li>Troubleshoot and resolve technical issues</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">3.3 Communication</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
                <li>Send important service announcements</li>
                <li>Provide customer support</li>
                <li>Send optional marketing communications (with your consent)</li>
                <li>Notify you of policy changes</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. AI and Content Processing</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                <strong>Important:</strong> Your content may be processed by third-party AI services (Google Gemini, OpenAI) to generate captions and analyze images. These services operate under their own privacy policies:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li><strong>Google Gemini:</strong> Subject to Google's AI/ML Privacy Policy</li>
                <li><strong>OpenAI:</strong> Subject to OpenAI's Privacy Policy and Usage Policies</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                We do not store your content with these third-party services longer than necessary for processing. Generated content is stored securely on our platform for your access and history.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Data Sharing and Disclosure</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5.1 We Do Not Sell Your Data</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We do not sell, rent, or trade your personal information to third parties for their commercial purposes.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5.2 Service Providers</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We may share information with trusted service providers who assist us in operating our platform:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li><strong>Stripe:</strong> Payment processing</li>
                <li><strong>AI Providers:</strong> Content generation (Google, OpenAI)</li>
                <li><strong>Cloud Storage:</strong> Secure data hosting</li>
                <li><strong>Analytics Services:</strong> Platform performance monitoring</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">5.3 Legal Requirements</h3>
              <p className="text-gray-700 dark:text-gray-300">
                We may disclose information when required by law, regulation, legal process, or to protect the rights, property, or safety of ThottoPilot, our users, or others.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Data Security</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We implement industry-standard security measures to protect your information:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Encryption in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security audits and monitoring</li>
                <li>Secure payment processing through Stripe</li>
                <li>Image protection and watermarking capabilities</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                While we strive to protect your information, no method of transmission over the internet is 100% secure. We encourage you to use strong passwords and keep your account credentials confidential.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Your Rights and Choices</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7.1 Account Management</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Access and update your account information</li>
                <li>Download your content and generation history</li>
                <li>Delete your content and account data</li>
                <li>Manage your subscription and billing preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7.2 Communication Preferences</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Opt out of marketing communications</li>
                <li>Control notification settings</li>
                <li>Choose your preferred communication channels</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">7.3 Data Portability</h3>
              <p className="text-gray-700 dark:text-gray-300">
                You can request a copy of your data in a portable format. Contact us at privacy@thottopilot.com to make a request.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Cookies and Tracking</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li>Keep you signed in to your account</li>
                <li>Remember your preferences and settings</li>
                <li>Analyze platform usage and performance</li>
                <li>Provide personalized experiences</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                You can control cookie settings through your browser preferences. However, disabling certain cookies may limit platform functionality.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Data Retention</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We retain your information for as long as necessary to provide our services and comply with legal obligations:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 mb-4">
                <li><strong>Account Data:</strong> Until account deletion or as required by law</li>
                <li><strong>Generated Content:</strong> Until you delete it or close your account</li>
                <li><strong>Usage Analytics:</strong> Aggregated and anonymized for up to 2 years</li>
                <li><strong>Financial Records:</strong> As required by tax and accounting regulations</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300">
                When you delete your account, we will remove your personal information within 30 days, except where retention is required by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300">
                ThottoPilot is intended for users 18 years and older. We do not knowingly collect personal information from individuals under 18. If we become aware that we have collected information from someone under 18, we will delete it promptly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. International Data Transfers</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy and applicable laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Changes to This Policy</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We may update this Privacy Policy from time to time. We will notify you of material changes by email or through our platform. Continued use of our services after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                If you have questions about this Privacy Policy or our privacy practices, please contact us:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Email:</strong> privacy@thottopilot.com<br />
                  <strong>Subject:</strong> Privacy Policy Inquiry<br />
                  <strong>Response Time:</strong> We will respond within 48 hours
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">14. Effective Date</h2>
              <p className="text-gray-700 dark:text-gray-300">
                This Privacy Policy is effective as of February 14, 2025, and applies to all information previously collected and any information collected thereafter.
              </p>
            </section>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600 dark:text-gray-400">
          <p>© 2025 ThottoPilot. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}