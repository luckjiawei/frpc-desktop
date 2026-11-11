import i18n from "@/lang";
import { on, send } from "@/utils/ipcUtils";
import { isNewerVersion } from "@/utils/version";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import { ipcRouters } from "@/core/IpcRouter";
import pkg from "../../package.json";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({
    versions: [] as FrpcVersion[],
    lastRelease: null,
    language: null
  }),
  getters: {
    /** 已下载的 frpc 版本（不含 cloudflared） */
    downloadedVersions: state =>
      state.versions.filter(v => (v.provider ?? "frpc") === "frpc"),
    downloadedCloudflaredVersions: state =>
      state.versions.filter(v => v.provider === "cloudflared"),
    frpcDesktopLastRelease: state => state.lastRelease,
    frpcDesktopLanguage: state => state.language
  },
  actions: {
    onListenerDownloadedVersion() {
      on(ipcRouters.VERSION.getDownloadedVersions, data => {
        this.versions = data;
      });
    },
    refreshDownloadedVersion() {
      send(ipcRouters.VERSION.getDownloadedVersions);
    },
    onListenerFrpcDesktopGithubLastRelease(sd?: false) {
      on(ipcRouters.SYSTEM.getFrpcDesktopGithubLastRelease, data => {
        const { manual, version } = data || {};
        this.lastRelease = version;
        if (!this.lastRelease) {
          return;
        }
        // tagName相对固定
        const tagName = this.lastRelease["tag_name"];
        if (!tagName) {
          return;
        }
        // 最后版本号
        const lastVersion = (tagName || "").replace("v", "").toString();
        const currVersion = pkg.version;
        if (isNewerVersion(lastVersion, currVersion)) {
          let content = this.lastRelease.body;
          content = content.replaceAll("\n", "<br/>");
          ElMessageBox.alert(
            content,
            i18n.global.t("about.update.newVersion", {
              version: this.lastRelease.name
            }),
            {
              showCancelButton: true,
              cancelButtonText: i18n.global.t("common.close"),
              dangerouslyUseHTMLString: true,
              confirmButtonText: i18n.global.t("about.update.download")
            }
          ).then(() => {
            send(ipcRouters.SYSTEM.openUrl, {
              url: this.lastRelease["html_url"]
            });
          });
        } else {
          if (manual) {
            ElMessage({
              message: i18n.global.t("about.tips.latestVersion"),
              type: "success"
            });
          }
        }
      });
    },
    checkNewVersion(manual: boolean) {
      send(ipcRouters.SYSTEM.getFrpcDesktopGithubLastRelease, {
        manual: manual
      });
    },
    onListenerFrpcDesktopLanguage() {
      on(ipcRouters.SERVER.getLanguage, data => {
        this.language = data;
        i18n.global.locale = data;
      });
    },
    getLanguage() {
      send(ipcRouters.SERVER.getLanguage);
    }
  }
});
