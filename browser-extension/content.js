// PromotionPro Reddit Helper - Content Script
// Auto-fills Reddit post forms with content from PromotionPro

(function() {
  'use strict';

  // Check if we're on a Reddit submit page
  const isSubmitPage = () => {
    return window.location.pathname.includes('/submit') || 
           window.location.pathname.includes('/r/') && window.location.pathname.includes('/submit');
  };

  // Get the current subreddit from URL
  const getCurrentSubreddit = () => {
    const match = window.location.pathname.match(/\/r\/([^\/]+)/);
    return match ? match[1] : '';
  };

  // Find Reddit form elements (works for both new and old Reddit)
  const findFormElements = () => {
    // New Reddit selectors
    let titleInput = document.querySelector('[data-testid="title-field"]') || 
                    document.querySelector('textarea[placeholder*="title" i]') ||
                    document.querySelector('input[placeholder*="title" i]');
    
    let textArea = document.querySelector('[data-testid="text-field"]') || 
                   document.querySelector('textarea[placeholder*="text" i]') ||
                   document.querySelector('div[data-testid="texteditor-wrapper"] textarea');

    // Old Reddit fallbacks
    if (!titleInput) {
      titleInput = document.querySelector('input[name="title"]') ||
                   document.querySelector('#title-field');
    }
    
    if (!textArea) {
      textArea = document.querySelector('textarea[name="text"]') ||
                 document.querySelector('#text-field') ||
                 document.querySelector('.usertext-edit textarea');
    }

    return { titleInput, textArea };
  };

  // Create the PromotionPro helper UI
  const createHelperUI = () => {
    if (document.getElementById('promotionpro-helper')) return;

    const helper = document.createElement('div');
    helper.id = 'promotionpro-helper';
    helper.innerHTML = `
      <div class="pp-helper-card">
        <div class="pp-helper-header">
          <div class="pp-helper-logo">
            <span class="pp-shield">🛡️</span>
            <span class="pp-title">PromotionPro</span>
          </div>
          <button class="pp-toggle" id="pp-toggle">−</button>
        </div>
        <div class="pp-helper-content" id="pp-content">
          <div class="pp-status" id="pp-status">
            Ready to auto-fill from PromotionPro
          </div>
          <div class="pp-controls">
            <button class="pp-btn pp-btn-primary" id="pp-fill-last">
              Fill Last Generated
            </button>
            <button class="pp-btn pp-btn-secondary" id="pp-clear">
              Clear Fields
            </button>
          </div>
          <div class="pp-subreddit-info">
            <span class="pp-sub-label">Subreddit:</span>
            <span class="pp-sub-name" id="pp-subreddit">${getCurrentSubreddit() || 'Unknown'}</span>
          </div>
          <div class="pp-tips">
            <small>💡 Generate content in PromotionPro, then click "Fill Last Generated" here</small>
          </div>
        </div>
      </div>
    `;

    // Position the helper
    helper.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 320px;
    `;

    document.body.appendChild(helper);
    setupHelperEvents();
  };

  // Setup event listeners for the helper UI
  const setupHelperEvents = () => {
    const toggle = document.getElementById('pp-toggle');
    const content = document.getElementById('pp-content');
    const fillBtn = document.getElementById('pp-fill-last');
    const clearBtn = document.getElementById('pp-clear');

    // Toggle collapse/expand
    toggle.addEventListener('click', () => {
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'block' : 'none';
      toggle.textContent = isCollapsed ? '−' : '+';
    });

    // Fill last generated content
    fillBtn.addEventListener('click', fillLastGenerated);
    
    // Clear form fields
    clearBtn.addEventListener('click', clearFields);
  };

  // Fill form with last generated content from PromotionPro
  const fillLastGenerated = async () => {
    const statusEl = document.getElementById('pp-status');
    statusEl.textContent = 'Loading content...';
    statusEl.className = 'pp-status pp-loading';

    try {
      // Get stored content from extension storage
      const result = await chrome.storage.local.get(['lastGenerated']);
      const content = result.lastGenerated;

      if (!content) {
        // Try to get from PromotionPro if it's open in another tab
        const promotionProContent = await getContentFromPromotionPro();
        if (promotionProContent) {
          await fillForm(promotionProContent);
          statusEl.textContent = 'Content filled from PromotionPro!';
          statusEl.className = 'pp-status pp-success';
        } else {
          statusEl.textContent = 'No content found. Generate in PromotionPro first.';
          statusEl.className = 'pp-status pp-error';
        }
        return;
      }

      await fillForm(content);
      statusEl.textContent = 'Content filled successfully!';
      statusEl.className = 'pp-status pp-success';
      
    } catch (error) {
      console.error('PromotionPro Helper Error:', error);
      statusEl.textContent = 'Error filling content. Try again.';
      statusEl.className = 'pp-status pp-error';
    }

    // Reset status after 3 seconds
    setTimeout(() => {
      statusEl.textContent = 'Ready to auto-fill from PromotionPro';
      statusEl.className = 'pp-status';
    }, 3000);
  };

  // Try to get content from PromotionPro tab
  const getContentFromPromotionPro = () => {
    return new Promise((resolve) => {
      // Check if PromotionPro is running locally
      fetch('http://localhost:5000/api/stats')
        .then(() => {
          // PromotionPro is running, try to get last generated content
          return fetch('http://localhost:5000/api/last-generated');
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('No content available');
        })
        .then(data => {
          resolve(data);
        })
        .catch(() => {
          resolve(null);
        });
    });
  };

  // Fill the Reddit form with content
  const fillForm = async (content) => {
    const { titleInput, textArea } = findFormElements();
    
    if (!titleInput || !textArea) {
      throw new Error('Could not find Reddit form fields');
    }

    // Get a random title
    const randomTitle = content.titles[Math.floor(Math.random() * content.titles.length)];
    
    // Fill title
    titleInput.focus();
    titleInput.value = randomTitle;
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    titleInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Small delay for React to process
    await new Promise(resolve => setTimeout(resolve, 200));

    // Fill content
    textArea.focus();
    textArea.value = content.content;
    textArea.dispatchEvent(new Event('input', { bubbles: true }));
    textArea.dispatchEvent(new Event('change', { bubbles: true }));

    // Trigger any additional events for new Reddit
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content.content
    });
    textArea.dispatchEvent(inputEvent);
  };

  // Clear form fields
  const clearFields = () => {
    const { titleInput, textArea } = findFormElements();
    
    if (titleInput) {
      titleInput.value = '';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    if (textArea) {
      textArea.value = '';
      textArea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const statusEl = document.getElementById('pp-status');
    statusEl.textContent = 'Fields cleared';
    statusEl.className = 'pp-status pp-success';

    setTimeout(() => {
      statusEl.textContent = 'Ready to auto-fill from PromotionPro';
      statusEl.className = 'pp-status';
    }, 2000);
  };

  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillContent' && request.content) {
      fillForm(request.content)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response
    }
  });

  // Initialize when page loads
  const init = () => {
    if (!isSubmitPage()) return;
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(createHelperUI, 1000);
      });
    } else {
      setTimeout(createHelperUI, 1000);
    }
  };

  init();
})();