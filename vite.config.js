
/* eslint-env node */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import process from "node:process";
import { visualizer } from "rollup-plugin-visualizer";

const pwaPluginOptions = {
    registerType: "autoUpdate",
    includeAssets: ["logo.png", "thottopilot-logo.png"],
    manifest: {
        name: "ThottoPilot",
        short_name: "ThottoPilot",
        description: "AI-powered content creation platform for adult content creators",
        theme_color: "#EC4899",
        background_color: "#0A0E27",
        display: "standalone",
        scope: "/",
        start_url: "/",
        orientation: "portrait",
        icons: [
            {
                src: "/logo.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable",
            },
        ],
    },
    workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
            {
                urlPattern: /^https:\/\/api\./,
                handler: "NetworkFirst",
                options: {
                    cacheName: "api-cache",
                    expiration: {
                        maxEntries: 50,
                        maxAgeSeconds: 300, // 5 minutes
                    },
                },
            },
            {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                handler: "CacheFirst",
                options: {
                    cacheName: "image-cache",
                    expiration: {
                        maxEntries: 100,
                        maxAgeSeconds: 86400, // 1 day
                    },
                },
            },
        ],
    },
};

const isModuleNotFoundError = (error) => {
    if (!(error instanceof Error)) {
        return false;
    }

    const referencesPlugin =
        typeof error.message === "string" && error.message.includes("vite-plugin-pwa");
    return "code" in error && error.code === "ERR_MODULE_NOT_FOUND" && referencesPlugin;
};

const createPwaPlugin = async () => {
    try {
        const { VitePWA } = await import("vite-plugin-pwa");
        return VitePWA(pwaPluginOptions);
    }
    catch (error) {
        if (isModuleNotFoundError(error)) {
            console.warn("vite-plugin-pwa not installed; skipping PWA plugin.");
            return null;
        }
        throw error;
    }
};

const vendorManualChunks = {
    "vendor-react": ["react", "react-dom"],
    "vendor-stripe": ["@stripe/stripe-js", "@stripe/react-stripe-js"],
    "vendor-radix": [
        "@radix-ui/react-accordion",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-aspect-ratio",
        "@radix-ui/react-avatar",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-collapsible",
        "@radix-ui/react-context-menu",
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-hover-card",
        "@radix-ui/react-label",
        "@radix-ui/react-menubar",
        "@radix-ui/react-navigation-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-progress",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-scroll-area",
        "@radix-ui/react-select",
        "@radix-ui/react-separator",
        "@radix-ui/react-slider",
        "@radix-ui/react-slot",
        "@radix-ui/react-switch",
        "@radix-ui/react-tabs",
        "@radix-ui/react-toast",
        "@radix-ui/react-toggle",
        "@radix-ui/react-toggle-group",
        "@radix-ui/react-tooltip",
    ],
};

export default defineConfig(async ({ command, mode }) => {
    const isBuild = command === "build";
    const isProduction = mode === "production";

    const plugins = [react(), runtimeErrorOverlay()];

    const pwaPlugin = await createPwaPlugin();
    if (pwaPlugin !== null) {
        plugins.push(pwaPlugin);
    }

    if (!isProduction && process.env.REPL_ID !== undefined) {
        const { cartographer } = await import("@replit/vite-plugin-cartographer");
        plugins.push(cartographer());
    }

    if (isBuild) {
        plugins.push(
            visualizer({
                filename: "bundle-report.html",
                gzipSize: true,
                brotliSize: true,
            }),
        );
    }

    return {
        plugins,
        resolve: {
            alias: {
                "@": path.resolve(import.meta.dirname, "client", "src"),
                "@shared": path.resolve(import.meta.dirname, "shared"),
                "@assets": path.resolve(import.meta.dirname, "attached_assets"),
                "@/dashboard": path.resolve(import.meta.dirname, "client", "src", "app", "(dashboard)"),
            },
        },
        root: "client",
        build: {
            // place client build alongside server build
            outDir: "dist",
            emptyOutDir: true,
            rollupOptions: {
                output: {
                    manualChunks: vendorManualChunks,
                },
            },
        },
        server: {
            fs: {
                strict: true,
                deny: ["**/.*"],
            },
            proxy: {
                "/api": {
                    target: "http://localhost:3005",
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
});
