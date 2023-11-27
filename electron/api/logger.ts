import { app, ipcMain } from "electron";

const fs = require("fs");
const path = require("path");
export const initLoggerApi = () => {
  const logPath = path.join(app.getPath("userData"), "frpc.log");

  const readLogger = (callback: (content: string) => void) => {
    fs.readFile(logPath, "utf-8", (error, data) => {
      if (!error) {
        callback(data);
      }
    });
  };

  ipcMain.on("logger.getLog", async (event, args) => {
    readLogger(content => {
      event.reply("Logger.getLog.hook", content);
    });
  });
  ipcMain.on("logger.update", (event, args) => {
    fs.watch(logPath, (eventType, filename) => {
      if (eventType === "change") {
        readLogger(content => {
          event.reply("Logger.update.hook", content);
        });
      }
    });
  });
};
