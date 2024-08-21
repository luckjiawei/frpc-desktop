import { app, dialog, ipcMain } from "electron";
import { getConfig, saveConfig } from "../storage/config";
import { listVersion } from "../storage/version";
import { generateConfig, genIniConfig, genTomlConfig } from "./frpc";
import { exec } from "child_process";
import { listProxy } from "../storage/proxy";
import path from "path";
import fs from "fs";

const log = require("electron-log");

export const initConfigApi = () => {
  ipcMain.on("config.saveConfig", async (event, args) => {
    saveConfig(args, (err, numberOfUpdated, upsert) => {
      if (!err) {
        const start = args.systemSelfStart || false;
        log.info("开启自启状态", start);
        app.setLoginItemSettings({
          openAtLogin: start, //win
          openAsHidden: start //macOs
        });
      }
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

  ipcMain.on("config.exportConfig", async (event, args) => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
    const outputDirectory = result.filePaths[0];
    log.info(`导出目录 ${outputDirectory} 类型：${args}`);
    getConfig((err1, config) => {
      if (!err1 && config) {
        listProxy((err2, proxys) => {
          if (!err2) {
            let configContent = "";
            if (args === "ini") {
              configContent = genIniConfig(config, proxys);
            } else if (args === "toml") {
              configContent = genTomlConfig(config, proxys);
            }
            const configPath = path.join(
              outputDirectory,
              `frpc-desktop.${args}`
            );
            fs.writeFile(
              configPath, // 配置文件目录
              configContent, // 配置文件内容
              { flag: "w" },
              err => {
                if (!err) {
                  // callback(filename);
                  event.reply("config.exportConfig.hook", {
                    data: "导出错误",
                    err: err
                  });
                }
              }
            );
            event.reply("Config.exportConfig.hook", {
              data: {
                configPath: configPath
              }
            });
          }
        });
      }
    });
  });
};
