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
createRoot(rootElement).render(<App />);
