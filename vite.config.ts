// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    // Gera o servidor em um arquivo só. Dividido em pedaços, o empacotador (rolldown) criava
    // importações circulares entre eles e o site quebrava em produção
    // ("__commonJSMin is not a function").
    // (opção do nitro que o tipo do @lovable.dev/vite-tanstack-config não lista, mas repassa)
    ...({ inlineDynamicImports: true } as object),
  },
});
