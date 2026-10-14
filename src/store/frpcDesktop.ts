import i18n from "@/lang";
import { on, send } from "@/utils/ipcUtils";
import { ElMessage, ElMessageBox } from "element-plus";
import { defineStore } from "pinia";
import { ipcRouters } from "@/core/IpcRouter";
import pkg from "../../package.json";

export const useFrpcDesktopStore = defineStore("frpcDesktop", {
  state: () => ({
    versions: [],
    lastRelease: null,
    language: null
  }),
  getters: {
    downloadedVersions: state => state.versions,
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
        let lastReleaseVersion = true;
        if (!tagName) {
          return;
        }
        // 最后版本号
        const lastVersion = (tagName || "").replace("v", "").toString();
        const currVersion = pkg.version;
        lastReleaseVersion = currVersion >= lastVersion;
        // return false;
        if (!lastReleaseVersion) {
          let content = this.lastRelease.body;
          content = content.replaceAll("\n", "<br/>");
          ElMessageBox.alert(
            content,
            `🎉 发现新版本 ${this.lastRelease.name}`,
            {
              showCancelButton: true,
              cancelButtonText: "关闭",
              dangerouslyUseHTMLString: true,
              confirmButtonText: "去下载"
            }
          ).then(() => {
            send(ipcRouters.SYSTEM.openUrl, {
              url: this.lastRelease["html_url"]
            });
          });
        } else {
          if (manual) {
            ElMessage({
              message: "当前已是最新版本",
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
