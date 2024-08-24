import { app, ipcMain, shell } from "electron";
import log from "electron-log";

export const initCommonApi = () => {
  // 打开链接
  ipcMain.on("common.openUrl", async (event, args) => {
    if (args) {
      log.info(`打开链接：${args}`);
      shell.openExternal(args).then(() => {});
    }
  });

  ipcMain.on("common.relaunch", () => {
    app.relaunch();
    app.quit();
  });
};
