[Reading 18 lines from start (total: 18 lines, 0 remaining)]

import { defineConfig } from "vite";
import { resolve } from "node:path";

const root = process.cwd();
const pages = [
  "index", "notre-ecole", "enseignements", "louange", "empd-tv",
  "galerie", "ressources", "publications", "contact", "admin"
];

export default defineConfig({
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [page, resolve(root, `${page}.html`)])
      )
    }
  }
});