# PromotionPro Reddit Helper - Browser Extension

Auto-fills Reddit posts with content generated from PromotionPro, making posting faster and easier for content creators.

## Features

- **Auto-detects Reddit submit pages** - Works on both old and new Reddit
- **One-click auto-fill** - Fills title and content from your last PromotionPro generation
- **Smart form detection** - Automatically finds Reddit's form fields
- **Clean UI** - Minimal, collapsible helper that stays out of your way
- **Real-time status** - Shows current subreddit and connection status

## Installation

1. **Download the extension folder** to your computer
2. **Open Chrome** and go to `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top right)
4. **Click "Load unpacked"** and select the browser-extension folder
5. **Pin the extension** to your toolbar for easy access

## How to Use

### Step 1: Generate Content
1. Open PromotionPro (http://localhost:5000)
2. Generate content with your preferred settings
3. Choose promotion settings based on subreddit rules

### Step 2: Post to Reddit
1. Go to any Reddit submit page (like r/yoursubreddit/submit)
2. The PromotionPro helper will appear in the top-right
3. Click **"Fill Last Generated"** to auto-fill the form
4. Review and submit your post

## Supported Reddit Pages

- New Reddit: `reddit.com/r/subreddit/submit`
- Old Reddit: `old.reddit.com/r/subreddit/submit`
- General submit: `reddit.com/submit`

## Troubleshooting

**Extension not working?**
- Make sure PromotionPro is running at http://localhost:5000
- Check that you've generated content recently
- Try refreshing the Reddit page

**Fields not filling?**
- The extension works with both old and new Reddit
- If fields don't fill, try clicking in the title field first
- Some custom Reddit themes may interfere

**Connection issues?**
- Click the extension icon to test connection
- Make sure PromotionPro is running locally
- Check browser console for any errors

## Privacy & Security

- **All processing happens locally** - No data sent to external servers
- **No Reddit credentials stored** - Extension only fills forms
- **Works with your existing Reddit session** - No additional login required
- **Source code available** - Fully transparent operation

## Technical Details

- **Manifest V3** - Uses latest Chrome extension standards
- **Content Script** - Injects helper UI only on Reddit submit pages
- **Local API** - Communicates with PromotionPro running on localhost:5000
- **Cross-platform** - Works on Windows, Mac, and Linux

## Future Features

- Support for multiple saved content pieces
- Scheduled posting capabilities
- Integration with mobile app version
- Advanced form validation

---

Made for content creators by PromotionPro | v1.0