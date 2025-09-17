import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
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

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: "20px", textAlign: "center" }}>
      <h1>Something went wrong:</h1>
      <pre style={{ color: "red" }}>{error.message}</pre>
      <button onClick={() => window.location.reload()}>Reload App</button>
    </div>
  );
}

try {
  createRoot(rootElement).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  );
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
