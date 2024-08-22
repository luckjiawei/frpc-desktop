import Datastore from "nedb";
import path from "path";
import { app } from "electron";

const log = require("electron-log");

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
  log.debug(`保存日志 ${JSON.stringify(document)}`);
  configDB.update({ _id: "1" }, document, { upsert: true }, cb);
};

/**
 * 查找
 * @param cb
 */
export const getConfig = (
  cb: (err: Error | null, document: FrpConfig) => void
) => {
  configDB.findOne({ _id: "1" }, cb);
};

export const clearConfig = (cb?: (err: Error | null, n: number) => void) => {
  configDB.remove({}, { multi: true }, cb);
};