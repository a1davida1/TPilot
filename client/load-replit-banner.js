if (import.meta.env.MODE === 'development') {
  const script = document.createElement('script');
  script.src = 'https://replit.com/public/js/replit-dev-banner.js';
  document.head.appendChild(script);
}