import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  // Em desenvolvimento o Vite só expõe variáveis VITE_* ao código; o servidor (server functions,
  // webhooks) lê process.env. Carregamos o .env inteiro para o processo para o `npm run dev` funcionar.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    server: { host: true, port: 3000 },
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-router"] },
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart(),
      // Gera um servidor Node autônomo em .output/ (node .output/server/index.mjs)
      nitro(),
      viteReact(),
    ],
  };
});
