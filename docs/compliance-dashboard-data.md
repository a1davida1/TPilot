
# Compliance Dashboard Data Contract

The admin compliance dashboard currently renders mocked data defined in
`client/src/components/compliance/ComplianceStatusDashboard.tsx`. When the
moderation ingestion service is ready, replace the `dummyComplianceData`
constant with a response returned from the backend that satisfies the interface
below.

```ts
export interface SubredditRemoval {
  id: string; // Stable identifier aligned with the source moderation log entry
  removedAt: string; // ISO 8601 timestamp for when the content was removed
  reason: string; // Human readable description of the removal reason
  actionTaken?: string; // Optional follow up action (warning, escalation, etc.)
}

export interface SubredditComplianceStatus {
  name: string; // Subreddit name without the leading `r/`
  shadowbanned: boolean; // Whether automation detects a shadowban risk
  verificationStatus: 'pending' | 'review' | 'verified'; // Compliance verification stage
  nextPostTime: string; // ISO timestamp for the next safe posting window
  recentRemovals: SubredditRemoval[]; // Most recent moderation removal events
}
```

### Expected backend response

Return an array of `SubredditComplianceStatus` objects ordered by priority or
subreddit name. Each object should include the last five removals in
`recentRemovals`, ensuring the front end can render the moderation table without
additional sorting.

```json
[
  {
    "name": "CreatorSupport",
    "shadowbanned": false,
    "verificationStatus": "verified",
    "nextPostTime": "2024-03-09T18:30:00Z",
    "recentRemovals": [
      {
        "id": "CS-2051",
        "removedAt": "2024-03-07T21:15:00Z",
        "reason": "Automod: Affiliate link outside allowed domains",
        "actionTaken": "Auto-removed"
      }
    ]
  }
]
```

### Integration notes

- Use `SubredditComplianceStatus[]` as the response type so TypeScript enforces
  the contract.
- Keep timestamps in UTC ISO strings; the UI handles localization via
  `Intl.DateTimeFormat`.
- Ensure the API endpoint is accessible to authenticated admin users and cached
  appropriately for fast refreshes inside the dashboard tab.
