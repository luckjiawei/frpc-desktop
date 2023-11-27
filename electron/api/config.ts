import { ipcMain } from "electron";
import { getConfig, saveConfig } from "../storage/config";
import { listVersion } from "../storage/version";

export const initConfigApi = () => {
  ipcMain.on("config.saveConfig", async (event, args) => {
    saveConfig(args, (err, numberOfUpdated, upsert) => {
      event.reply("Config.saveConfig.hook", {
        err: err,
        numberOfUpdated: numberOfUpdated,
        upsert: upsert
      });
    });
  });

  ipcMain.on("config.getConfig", async (event, args) => {
    getConfig((err, doc) => {
      event.reply("Config.getConfig.hook", {
        err: err,
        data: doc
      });
    });
  });

  ipcMain.on("config.versions", event => {
    listVersion((err, doc) => {
      event.reply("Config.versions.hook", {
        err: err,
        data: doc
      });
    });
  });

  ipcMain.on("config.hasConfig", event => {
    getConfig((err, doc) => {
      event.reply("Config.getConfig.hook", {
        err: err,
        data: doc
      });
    });
  });
};
