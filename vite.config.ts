import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  // Required for Electron: assets must use relative paths so they resolve
  // correctly when loaded via file:// on packaged Windows builds.
  base: "./",
  server: {
    host: "localhost",
    port: 8081,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
