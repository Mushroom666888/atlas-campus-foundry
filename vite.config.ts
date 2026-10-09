import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { catalog } from "./packages/modules/src/catalog.js";
export default defineConfig({
  plugins: [react()],
  define: {
    __ATLAS_CATALOG__: JSON.stringify(
      catalog.map(({ moduleId, name, category }) => ({
        moduleId,
        name,
        category,
      })),
    ),
  },
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1" },
});
