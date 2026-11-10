import { defineConfig } from "vite";

// base "./" permite publicar en https://usuario.github.io/<repositorio>/ sin configurar nada más.
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
