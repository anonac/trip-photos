import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base + hash routing = works on any GitHub Pages URL, no 404 tricks.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
