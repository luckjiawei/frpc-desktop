import Datastore from "nedb";
import path from "path";
import { app } from "electron";

import { logInfo, logError, LogModule, logDebug } from "../utils/log";
import { maskSensitiveData } from "../utils/desensitize";

const configDB = new Datastore({
  autoload: true,
  filename: path.join(app.getPath("userData"), "config.db")
});
/**
 * 保存
 */
export const saveConfig = (
  document: FrpConfig,
  cb?: (err: Error | null, numberOfUpdated: number, upsert: boolean) => void
) => {
  document["_id"] = "1";
  logDebug(
    LogModule.DB,
    `Saving configuration to the database. ${JSON.stringify(
      maskSensitiveData(document, [
        "serverAddr",
        "serverPort",
        "authToken",
        "user",
        "metaToken"
      ])
    )}`
  );
  configDB.update(
    { _id: "1" },
    document,
    { upsert: true },
    (err, numberOfUpdated, upsert) => {
      if (err) {
        logError(
          LogModule.DB,
          `Error saving configuration: ${err.message}`
        );
      } else {
        logInfo(
          LogModule.DB,
          `Configuration saved successfully. Updated: ${numberOfUpdated}, Upsert: ${upsert}`
        ); // 添加成功日志
      }
      if (cb) cb(err, numberOfUpdated, upsert);
    }
  );
};

/**
 * 查找
 * @param cb
 */
export const getConfig = (
  cb: (err: Error | null, document: FrpConfig) => void
) => {
  logInfo(LogModule.DB, "Retrieving configuration from the database."); // 添加信息日志
  configDB.findOne({ _id: "1" }, (err, document) => {
    if (err) {
      logError(
        LogModule.DB,
        `Error retrieving configuration: ${err.message}`
      ); // 添加错误日志
    } else {
      logInfo(LogModule.DB, "Configuration retrieved successfully."); // 添加成功日志
    }
    cb(err, document);
  });
};

export const clearConfig = (cb?: (err: Error | null, n: number) => void) => {
  logInfo(LogModule.DB, "Clearing all configurations from the database."); // 添加信息日志
  configDB.remove({}, { multi: true }, (err, n) => {
    if (err) {
      logError(
        LogModule.DB,
        `Error clearing configurations: ${err.message}`
      ); // 添加错误日志
    } else {
      logInfo(
        LogModule.DB,
        `Successfully cleared configurations. Number of documents removed: ${n}`
      ); // 添加成功日志
    }
    if (cb) cb(err, n);
  });
};
