import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply dark theme by default, but allow theme toggle to override
const savedTheme = localStorage.getItem('theme');
const prefersDark = savedTheme === 'dark' || (!savedTheme);
document.documentElement.classList.add(prefersDark ? 'dark' : 'light');

createRoot(document.getElementById("root")!).render(<App />);
