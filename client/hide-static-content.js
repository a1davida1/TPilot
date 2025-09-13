document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const staticContent = document.getElementById('static-content');
    if (staticContent && document.getElementById('root').children.length > 0) {
      staticContent.style.display = 'none';
    }
  }, 100);
});