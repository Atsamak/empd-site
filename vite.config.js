import { defineConfig } from "vite";
import { resolve } from "node:path";

const root = process.cwd();
const pages = [
  "index", "notre-ecole", "enseignements", "louange", "empd-tv",
  "galerie", "ressources", "publications", "contact", "admin",
  "connexion", "espace-membre"
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