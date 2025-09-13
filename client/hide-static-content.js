// Wait for React to mount and hide static content
(function() {
  let checkInterval;
  let checkCount = 0;
  const maxChecks = 100; // Check for up to 10 seconds (100 * 100ms)
  
  function hideStaticContent() {
    const staticContent = document.getElementById('static-content');
    const rootElement = document.getElementById('root');
    
    if (staticContent && rootElement && rootElement.children.length > 0) {
      // React has mounted, hide static content
      staticContent.style.display = 'none';
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      console.log('Static content hidden after React mount');
    } else if (checkCount >= maxChecks) {
      // Timeout after 10 seconds
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      console.warn('Timeout waiting for React to mount');
    }
    checkCount++;
  }
  
  // Start checking when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      checkInterval = setInterval(hideStaticContent, 100);
    });
  } else {
    // DOM already loaded
    checkInterval = setInterval(hideStaticContent, 100);
  }
})();