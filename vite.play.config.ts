import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "play-src",
  publicDir: "../public",
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve("/workspace/src"),
    },
  },
  plugins: [tailwindcss(), viteReact()],
  build: {
    outDir: "../play-dist",
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
