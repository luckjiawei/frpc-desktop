import { resolve } from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/** 路径查找 */
const pathResolve = (dir: string): string => {
  return resolve(__dirname, ".", dir);
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": pathResolve("src"),
      "@build": pathResolve("build")
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler"
      }
    } as any
  },
  clearScreen: false,
  server: {
    port: 3344,
    strictPort: true,
    host: "127.0.0.1"
  },
  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/element-plus/") ||
            id.includes("/node_modules/@element-plus/") ||
            id.includes("/node_modules/@popperjs/") ||
            id.includes("/node_modules/async-validator/")
          ) {
            return "vendor-element-plus";
          }
          if (
            id.includes("/node_modules/vue/") ||
            id.includes("/node_modules/@vue/") ||
            id.includes("/node_modules/pinia/") ||
            id.includes("/node_modules/vue-i18n/") ||
            id.includes("/node_modules/vue-router/")
          ) {
            return "vendor-vue";
          }
        }
      }
    }
  }
});
