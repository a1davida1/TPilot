import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply dark theme by default, but allow theme toggle to override
const savedTheme = localStorage.getItem('theme');
const prefersDark = savedTheme === 'dark' || (!savedTheme);
document.documentElement.classList.add(prefersDark ? 'dark' : 'light');

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

try {
  createRoot(rootElement).render(<App />);
} catch (error) {
  console.error('Failed to render app:', error);
  rootElement.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1>Loading Error</h1>
      <p>There was an error loading the application. Please refresh the page.</p>
      <button onclick="window.location.reload()">Refresh</button>
    </div>
  `;
}
