import gitcodeIcon from "@/assets/GitCode.svg";
import { useFrpcDesktopStore } from "@/store/frpcDesktop";
import { send } from "@/utils/ipcUtils";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { ipcRouters } from "../../../electron/core/IpcRouter";
import pkg from "../../../package.json";

export const useAbout = () => {
  const frpcDesktopStore = useFrpcDesktopStore();
  const { t } = useI18n();

  /**
   * 最后一个版本号
   */
  const isLastVersion = computed(() => {
    if (!frpcDesktopStore.frpcDesktopLastRelease) {
      return true;
    }
    // tagName相对固定
    const tagName = frpcDesktopStore.frpcDesktopLastRelease["tag_name"];
    if (!tagName) {
      return true;
    }
    // 最后版本号
    const lastVersion = tagName.replace("v", "").toString();
    const currVersion = pkg.version;
    return currVersion >= lastVersion;
  });

  /**
   * 打开github issues
   */
  const handleOpenGitHubIssues = () => {
    send(ipcRouters.SYSTEM.openUrl, {
      url: "https://github.com/luckjiawei/frpc-desktop/issues"
    });
  };

  /**
   * 打开github主页
   */
  const handleOpenGitHub = () => {
    send(ipcRouters.SYSTEM.openUrl, {
      url: "https://github.com/luckjiawei/frpc-desktop"
    });
  };

  const handleOpenGitCode = () => {
    send(ipcRouters.SYSTEM.openUrl, {
      url: "https://gitcode.com/luckjiawei/frpc-desktop"
    });
  };

  /**
   * 打开捐赠界面
   */
  const handleOpenDonate = () => {
    send(ipcRouters.SYSTEM.openUrl, {
      url: "https://jwinks.com/donate"
    });
  };

  /**
   * 打开文档
   */
  const handleOpenDoc = () => {
    send(ipcRouters.SYSTEM.openUrl, {
      url: "https://jwinks.com/p/frp"
    });
  };

  /**
   * 获取最后一个版本
   */
  const handleGetLastVersion = () => {
    frpcDesktopStore.checkNewVersion(true);
  };

  const handleOpenNewVersion = () => {
    send(ipcRouters.SYSTEM.openUrl, {
      url: frpcDesktopStore.frpcDesktopLastRelease["html_url"]
    });
  };

  return {
    gitcodeIcon,
    frpcDesktopStore,
    t,
    pkg,
    isLastVersion,
    handleOpenGitHubIssues,
    handleOpenGitHub,
    handleOpenGitCode,
    handleOpenDonate,
    handleOpenDoc,
    handleGetLastVersion,
    handleOpenNewVersion
  };
};
