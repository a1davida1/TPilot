import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply dark theme globally for ThottoPilot
document.documentElement.classList.add('dark');

createRoot(document.getElementById("root")!).render(<App />);
