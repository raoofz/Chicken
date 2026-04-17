import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyDeviceAdaptations } from "./lib/deviceAdapter";

// Apply device-specific CSS classes before first render
// This prevents flash of wrong layout on low-end / iOS devices
applyDeviceAdaptations();

createRoot(document.getElementById("root")!).render(<App />);
