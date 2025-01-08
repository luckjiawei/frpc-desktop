import { app, ipcMain, shell } from "electron";
import { logInfo, logError, LogModule } from "../utils/log";

const fs = require("fs");
const path = require("path");
export const initLoggerApi = () => {
  const logPath = path.join(app.getPath("userData"), "frpc.log");

  const readLogger = (callback: (content: string) => void) => {
    fs.readFile(logPath, "utf-8", (error, data) => {
      if (!error) {
        logInfo(LogModule.LOGGER, "Log file read successfully.");
        callback(data);
      } else {
        logError(LogModule.LOGGER, `Error reading log file: ${error.message}`);
      }
    });
  };

  ipcMain.on("logger.getLog", async (event, args) => {
    logInfo(LogModule.LOGGER, "Received request to get log.");
    readLogger(content => {
      event.reply("Logger.getLog.hook", content);
      logInfo(LogModule.LOGGER, "Log data sent to client.");
    });
  });

  ipcMain.on("logger.update", (event, args) => {
    logInfo(LogModule.LOGGER, "Watching log file for changes.");
    fs.watch(logPath, (eventType, filename) => {
      if (eventType === "change") {
        logInfo(LogModule.LOGGER, "Log file changed, reading new content.");
        readLogger(content => {
          event.reply("Logger.update.hook", content);
          logInfo(LogModule.LOGGER, "Updated log data sent to client.");
        });
      }
    });
  });

  ipcMain.on("logger.openLog", (event, args) => {
    logInfo(LogModule.LOGGER, "Attempting to open log file.");
    shell.openPath(logPath).then((errorMessage) => {
      if (errorMessage) {
        logError(LogModule.LOGGER, `Failed to open Logger: ${errorMessage}`);
        event.reply("Logger.openLog.hook", false);
      } else {
        logInfo(LogModule.LOGGER, "Logger opened successfully.");
        event.reply("Logger.openLog.hook", true);
      }
    });
  });
};
