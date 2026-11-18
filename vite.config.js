import { defineConfig } from "vite";
import { resolve } from "node:path";

const root = process.cwd();
// La page admin reste hors du build public tant que l'authentification
// et les autorisations Supabase ne sont pas configurées.
const pages = [
  "index", "notre-ecole", "enseignements", "louange", "empd-tv",
  "galerie", "ressources", "publications", "contact"
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
