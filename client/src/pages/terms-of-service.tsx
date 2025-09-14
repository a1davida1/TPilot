import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TermsOfService() {
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

        {/* Terms Content */}
        <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-pink-200/30 dark:border-purple-700/30 shadow-xl p-8">
          <div className="prose prose-pink dark:prose-invert max-w-none">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400 bg-clip-text text-transparent mb-4">
              Terms of Service for ThottoPilot
            </h1>
            
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-8">
              <p><strong>Effective Date:</strong> February 14, 2025</p>
              <p><strong>Last Updated:</strong> February 14, 2025</p>
            </div>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 dark:text-gray-300">
                By accessing or using ThottoPilot ("Service"), you agree to be bound by these Terms of Service ("Terms"). 
                If you disagree with any part of these terms, you do not have permission to access the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Description of Service</h2>
              <p className="text-gray-700 dark:text-gray-300">
                ThottoPilot is a content scheduling and marketing automation platform that enables users to schedule, manage, 
                and distribute their social media content across multiple platforms. The Service does not create, produce, 
                or host adult content but provides tools for content creators to manage their marketing activities.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. Eligibility</h2>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>You must be at least 18 years of age to use this Service</li>
                <li>You must have the legal capacity to enter into a binding agreement</li>
                <li>You must not be barred from using the Service under applicable law</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. User Responsibilities and Content Compliance</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">4.1 Content Ownership and Responsibility</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>You retain all ownership rights to content you upload</li>
                <li>You are solely responsible for all content you upload, store, or distribute through the Service</li>
                <li>You represent and warrant that you own or have necessary rights to all content</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">4.2 Age Verification and 2257 Compliance</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                By uploading any content containing adult material, you certify that:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>All individuals depicted in any content are 18 years of age or older</li>
                <li>You maintain records required by 18 U.S.C. § 2257 and related regulations for all uploaded content</li>
                <li>You will provide such records to authorities if required by law</li>
                <li>No content depicts minors in any context</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">4.3 Prohibited Content</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                You agree <strong>NOT</strong> to upload, post, or transmit content that:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Contains child sexual abuse material (CSAM) or sexualizes minors</li>
                <li>You don't have rights to distribute</li>
                <li>Violates any applicable laws or regulations</li>
                <li>Contains malware, viruses, or harmful code</li>
                <li>Violates third-party platform terms where content will be distributed</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">4.4 Platform Compliance</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>You are responsible for ensuring your content complies with the terms of service of each platform you post to (Reddit, Twitter/X, etc.)</li>
                <li>ThottoPilot is not responsible for content removals or account suspensions on third-party platforms</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Service Use Restrictions</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                You agree <strong>not</strong> to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Use the Service for any illegal purpose</li>
                <li>Attempt to bypass any Service limitations</li>
                <li>Interfere with or disrupt the Service</li>
                <li>Reverse engineer or attempt to extract source code</li>
                <li>Use automated systems to access the Service beyond provided APIs</li>
                <li>Resell or redistribute the Service without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Privacy and Data Protection</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">6.1 Data Processing</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>We process data according to our Privacy Policy</li>
                <li>You consent to data processing necessary for Service operation</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">6.2 GDPR/CCPA Rights</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">Users have the right to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Request data export</li>
                <li>Request account deletion</li>
                <li>Opt-out of data selling (we do not sell data)</li>
                <li>Access privacy settings</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">6.3 Data Security</h3>
              <p className="text-gray-700 dark:text-gray-300">
                While we implement reasonable security measures to protect your data, no method of electronic storage or 
                transmission is 100% secure. We cannot guarantee absolute security and are not liable for unauthorized 
                access to your account, data leaks, or breaches that occur despite our reasonable security measures. 
                You are responsible for maintaining the confidentiality of your account credentials and for any disclosure 
                resulting from your actions or third-party services you authorize.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Payment Terms</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">7.1 Subscription Fees</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Subscription fees are billed in advance</li>
                <li>All fees are non-refundable except as required by law</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">7.2 Payment Processing</h3>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Payment processing is handled by third-party processors</li>
                <li>You agree to their terms and conditions</li>
                <li>We are not responsible for payment processor actions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Intellectual Property</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">8.1 Service IP</h3>
              <p className="text-gray-700 dark:text-gray-300">
                ThottoPilot and its original content, features, and functionality are owned by ThottoPilot and protected 
                by international copyright, trademark, and other intellectual property laws.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">8.2 User Content License</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                By uploading content, you grant ThottoPilot a limited, non-exclusive license to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Store and backup your content</li>
                <li>Display content within your account</li>
                <li>Transmit content to platforms you designate</li>
                <li>Generate thumbnails and previews</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 mt-3">
                This license terminates when you delete content from the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Disclaimer of Warranties</h2>
              <p className="text-gray-700 dark:text-gray-300">
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
                LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Limitation of Liability</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">10.1 No Consequential Damages</h3>
              <p className="text-gray-700 dark:text-gray-300">
                In no event shall ThottoPilot be liable for any indirect, incidental, special, consequential, or punitive 
                damages resulting from your use or inability to use the Service, including but not limited to damages from 
                data leaks, data breaches, unauthorized access, loss of data, or other security incidents.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">10.2 Maximum Liability</h3>
              <p className="text-gray-700 dark:text-gray-300">
                Our total liability shall not exceed the amount paid by you to the Service in the 12 months preceding the claim.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">10.3 Third-Party Actions</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We are not liable for:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Actions of hackers, cybercriminals, or other unauthorized third parties</li>
                <li>Data leaks or breaches resulting from third-party services, platforms, or integrations you choose to use with the Service</li>
                <li>Your failure to maintain secure account credentials</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Indemnification</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                You agree to indemnify and hold harmless ThottoPilot from any claims, damages, losses, and expenses 
                (including legal fees) arising from:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Your use of the Service</li>
                <li>Your content</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
                <li>Any claim that your content violates applicable laws including 2257 requirements</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. DMCA Compliance</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">12.1 Copyright Infringement</h3>
              <p className="text-gray-700 dark:text-gray-300">
                We respond to notices of alleged copyright infringement under the Digital Millennium Copyright Act.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">12.2 Designated Agent</h3>
              <p className="text-gray-700 dark:text-gray-300">
                DMCA notices should be sent to: <a href="mailto:support@thottopilot.com" className="text-pink-600 hover:text-pink-700 dark:text-pink-400">support@thottopilot.com</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. Account Termination</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">13.1 Termination by You</h3>
              <p className="text-gray-700 dark:text-gray-300">
                You may terminate your account at any time through account settings.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">13.2 Termination by Us</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                We may suspend or terminate your account for:
              </p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Violation of these Terms</li>
                <li>Non-payment</li>
                <li>Illegal activity</li>
                <li>At our sole discretion with 30 days' notice</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">14. Governing Law</h2>
              <p className="text-gray-700 dark:text-gray-300">
                These Terms are governed by the laws of Delaware without regard to conflict of law principles.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">15. Arbitration Agreement</h2>
              <p className="text-gray-700 dark:text-gray-300">
                Any disputes shall be resolved through binding arbitration rather than court proceedings, except where prohibited by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">16. Changes to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300">
                We reserve the right to modify these Terms at any time. Continued use after changes constitutes acceptance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">17. Severability</h2>
              <p className="text-gray-700 dark:text-gray-300">
                If any provision of these Terms is found unenforceable, the remaining provisions continue in full force.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">18. Contact Information</h2>
              <p className="text-gray-700 dark:text-gray-300">
                For questions about these Terms, contact us at:
              </p>
              <p className="text-gray-700 dark:text-gray-300 mt-3">
                Email: <a href="mailto:support@thottopilot.com" className="text-pink-600 hover:text-pink-700 dark:text-pink-400">support@thottopilot.com</a>
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">19. Special Provisions for Adult Content Creators</h2>
              
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">19.1 Acknowledgment of Risk</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">You acknowledge that:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Distribution of adult content carries legal and platform risks</li>
                <li>Platform policies may change without notice</li>
                <li>We cannot guarantee continuous service availability</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">19.2 No Legal Advice</h3>
              <p className="text-gray-700 dark:text-gray-300">
                Nothing in the Service constitutes legal advice. You should consult with legal counsel regarding 
                compliance with applicable laws.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-3">19.3 Content Moderation</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3">We reserve the right to:</p>
              <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-2">
                <li>Remove content that appears to violate laws</li>
                <li>Report suspected CSAM to authorities</li>
                <li>Cooperate with law enforcement</li>
              </ul>
            </section>

            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-center text-gray-700 dark:text-gray-300 font-medium">
                By using ThottoPilot, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </div>
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