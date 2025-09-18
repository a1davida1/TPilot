/* eslint-env node */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import process from "node:process";

export default defineConfig({
    plugins: [
        react(),
        runtimeErrorOverlay(),
        ...(process.env.NODE_ENV !== "production" &&
            process.env.REPL_ID !== undefined
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()),
            ]
            : []),
    ],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "client", "src"),
            "@shared": path.resolve(import.meta.dirname, "shared"),
            "@assets": path.resolve(import.meta.dirname, "attached_assets"),
        },
    },
    root: "client",
    build: {
        // place client build alongside server build
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom'],
                    ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
                    router: ['wouter'],
                    query: ['@tanstack/react-query'],
                    icons: ['lucide-react', 'react-icons'],
                }
            }
        },
        chunkSizeWarningLimit: 1000
    },
    server: {
        fs: {
            strict: true,
            deny: ["**/.*"],
        },
        proxy: {
            "/api": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
        },
    },
});