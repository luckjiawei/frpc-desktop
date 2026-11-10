import { ipcRouters } from "@/core/IpcRouter";
import { on, send } from "@/utils/ipcUtils";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { defineStore } from "pinia";

export type ThemeMode = "light" | "dark" | "auto";

// localStorage 只用作首帧前的缓存（见 index.html），设置以后端保存的为准
const THEME_CACHE_KEY = "frpc-theme";
const THEME_MODES: ThemeMode[] = ["light", "dark", "auto"];
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

const readCachedMode = (): ThemeMode => {
  const cached = localStorage.getItem(THEME_CACHE_KEY) as ThemeMode | null;
  return cached && THEME_MODES.includes(cached) ? cached : "auto";
};

export const useThemeStore = defineStore("theme", {
  state: () => ({
    mode: readCachedMode(),
    systemDark: darkQuery.matches
  }),
  getters: {
    isDark: state =>
      state.mode === "dark" || (state.mode === "auto" && state.systemDark)
  },
  actions: {
    init() {
      darkQuery.addEventListener("change", event => {
        this.systemDark = event.matches;
        this.apply();
      });
      on(ipcRouters.SERVER.getTheme, (data: ThemeMode) => {
        this.applyMode(data);
      });
      on(ipcRouters.SERVER.saveTheme, () => {});
      this.apply();
      send(ipcRouters.SERVER.getTheme);
    },
    setMode(mode: ThemeMode) {
      this.applyMode(mode);
      send(ipcRouters.SERVER.saveTheme, { theme: mode });
    },
    applyMode(mode: ThemeMode) {
      this.mode = THEME_MODES.includes(mode) ? mode : "auto";
      localStorage.setItem(THEME_CACHE_KEY, this.mode);
      this.apply();
    },
    apply() {
      document.documentElement.classList.toggle("dark", this.isDark);
      // 同步原生标题栏；auto 交给系统决定
      try {
        getCurrentWindow()
          .setTheme(this.mode === "auto" ? null : this.mode)
          .catch(() => {});
      } catch {
        // 非 Tauri 环境（如浏览器预览）忽略
      }
    }
  }
});
