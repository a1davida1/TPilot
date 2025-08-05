// PromotionPro Reddit Helper - Popup Script

document.addEventListener('DOMContentLoaded', function() {
  const statusEl = document.getElementById('status');
  const openBtn = document.getElementById('openPromotionPro');
  const testBtn = document.getElementById('testConnection');

  // Test connection to PromotionPro
  async function testConnection() {
    statusEl.textContent = 'Testing connection...';
    
    try {
      const response = await fetch('http://localhost:5000/api/stats');
      if (response.ok) {
        const data = await response.json();
        statusEl.textContent = `Connected! ${data.totalGenerated} posts generated`;
        return true;
      } else {
        throw new Error('Server response not OK');
      }
    } catch (error) {
      statusEl.textContent = 'PromotionPro not running locally';
      return false;
    }
  }

  // Open PromotionPro
  function openPromotionPro() {
    chrome.tabs.create({ 
      url: 'http://localhost:5000',
      active: true 
    });
  }

  // Check current tab for Reddit submit page
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (tab.url && (tab.url.includes('reddit.com') && tab.url.includes('submit'))) {
        statusEl.textContent = 'Reddit submit page detected!';
      } else if (tab.url && tab.url.includes('reddit.com')) {
        statusEl.textContent = 'On Reddit - go to submit page';
      } else {
        statusEl.textContent = 'Ready to help with Reddit posting';
      }
    } catch (error) {
      statusEl.textContent = 'Ready to help with Reddit posting';
    }
  }

  // Event listeners
  openBtn.addEventListener('click', openPromotionPro);
  testBtn.addEventListener('click', testConnection);

  // Initialize
  checkCurrentTab();
  testConnection();
});