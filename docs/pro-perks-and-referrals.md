# Pro Perks & Referral Dashboard

## Overview

ThottoPilot offers two distinct systems for creators to monetize and access exclusive benefits:

1. **Pro Perks** - Curated partner programs and affiliate opportunities
2. **Referral Dashboard** - Direct affiliate management for ThottoPilot subscriptions

These systems serve different purposes and live on separate surfaces within the application.

## Pro Perks

**Location:** Accessible via the main navigation

**Purpose:** Provides Pro members with exclusive access to curated partner programs, affiliate opportunities, and monetization tools from trusted third-party platforms.

**Features:**
- Browse affiliate programs by category (Affiliate, Integration, Tools, Community, Pro Exclusives)
- Search and filter partner programs
- View commission rates and earning potential
- Access signup instructions and requirements
- Generate referral codes for specific partner programs
- Track application status (Available, Application Required, Coming Soon)

**Who Can Access:**
- Pro and Premium tier members have full access
- Free and Guest users see the module but are prompted to upgrade

**Use Cases:**
- Discovering monetization opportunities beyond ThottoPilot
- Accessing exclusive deals with creator tools and platforms
- Building additional revenue streams through partnerships
- Connecting with community programs and networks

**CTA Location:** The Pro Perks UI includes a prominent "Referral Hub" CTA card at the top, which directs users to the separate referral dashboard for ThottoPilot-specific affiliate management.

## Referral Dashboard

**Location:** `/referral` route - Accessible via the Referral Hub CTA in Pro Perks or direct navigation

**Purpose:** Dedicated interface for managing ThottoPilot-specific referral campaigns and tracking affiliate earnings from referring new users to the platform.

**Features:**
- Generate and manage personal referral codes
- Track referral signups and conversions
- View payout history and pending earnings
- Access campaign assets and promotional materials
- Monitor referral performance metrics
- Manage affiliate account settings

**Who Can Access:**
- All users (Free, Pro, Premium) can access the referral system
- Free users can still earn affiliate payouts even without a Pro subscription

**Use Cases:**
- Sharing ThottoPilot with other creators
- Building passive income through platform referrals
- Accessing marketing materials for promotion
- Tracking affiliate performance and earnings

## Key Differences

| Feature | Pro Perks | Referral Dashboard |
|---------|-----------|-------------------|
| **Focus** | Third-party partner programs | ThottoPilot platform referrals |
| **Access** | Pro/Premium members | All users |
| **Programs** | Multiple curated partners | ThottoPilot subscription only |
| **Location** | Main navigation | `/referral` route |
| **Payout Source** | Partner platforms | ThottoPilot directly |

## Navigation Flow

1. **From Pro Perks to Referral Dashboard:**
   - Users viewing Pro Perks see a prominent "Referral Hub" CTA card
   - Card includes description: "Track signups, campaign assets, and payouts in one dashboard designed for affiliates"
   - Clicking "Open referral hub" button navigates to `/referral`
   - Button has `data-testid="referral-hub-cta"` for testing

2. **Direct Navigation:**
   - Users can directly navigate to `/referral` via URL or app navigation
   - The referral system is independent of Pro Perks membership

## Technical Implementation

### Routing
- **Pro Perks:** Uses Wouter `<Link to="/referral">` component for navigation
- **Referral Dashboard:** Mounted at `/referral` route in the application

### Component Separation
- Pro Perks component: `client/src/components/pro-perks.tsx`
- Referral Dashboard: Separate component/page at `/referral`
- No code overlap or shared state between the two systems

### API Endpoints
- Pro Perks: `/api/pro-resources`, `/api/pro-resources/:id/referral-code`
- Referral Dashboard: Separate API endpoints for referral management (not documented in Pro Perks module)

## Best Practices

### For Users
1. **Maximize Earning Potential:** Use both systems - Pro Perks for partner programs and Referral Dashboard for platform referrals
2. **Free Users:** Even without Pro access, you can still earn through the Referral Dashboard
3. **Pro Users:** Explore Pro Perks regularly for new partnership opportunities

### For Developers
1. **Maintain Separation:** Keep Pro Perks and Referral Dashboard as distinct systems
2. **Cross-Promotion:** Pro Perks should always include the Referral Hub CTA for discoverability
3. **Consistent Routing:** Use Wouter's `<Link>` component with `to` prop (not `href`)
4. **Testing:** Verify both systems work independently and the CTA navigation functions correctly

## Future Enhancements

- Integration between systems for unified earnings tracking
- Cross-referral opportunities (refer to partner programs from within Pro Perks)
- Combined analytics dashboard showing all revenue streams
- Enhanced partner program discovery with AI-powered recommendations
