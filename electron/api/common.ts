import { app, ipcMain, shell } from "electron";
import { logError, logInfo, LogModule, logWarn } from "../utils/log";

export const initCommonApi = () => {
  ipcMain.on("common.openUrl", async (event, args) => {
    if (args) {
      logInfo(LogModule.APP, `Attempting to open URL: ${args}`);
      try {
        await shell.openExternal(args);
        logInfo(LogModule.APP, `Successfully opened URL: ${args}`);
      } catch (error) {
        logError(
          LogModule.APP,
          `Failed to open URL: ${args}. Error: ${error.message}`
        );
      }
    } else {
      logWarn(LogModule.APP, "No URL provided to open.");
    }
  });

  ipcMain.on("common.relaunch", () => {
    logInfo(LogModule.APP, "Application is relaunching.");
    app.relaunch();
    app.quit();
  });
};
