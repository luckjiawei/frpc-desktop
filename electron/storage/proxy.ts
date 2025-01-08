import Datastore from "nedb";
import path from "path";
import { app } from "electron";

import { logInfo, logError, LogModule, logDebug } from "../utils/log";

const proxyDB = new Datastore({
  autoload: true,
  filename: path.join(app.getPath("userData"), "proxy.db")
});

export const insertProxy = (
  proxy: Proxy,
  cb?: (err: Error | null, document: Proxy) => void
) => {
  logInfo(LogModule.DB, `Inserting proxy: ${JSON.stringify(proxy)}`);
  proxyDB.insert(proxy, (err, document) => {
    if (err) {
      logError(LogModule.DB, `Error inserting proxy: ${err.message}`);
    } else {
      logInfo(
        LogModule.DB,
        `Proxy inserted successfully: ${JSON.stringify(document)}`
      );
    }
    if (cb) cb(err, document);
  });
};

export const deleteProxyById = (
  _id: string,
  cb?: (err: Error | null, n: number) => void
) => {
  logDebug(`删除代理：${_id}`);
  logInfo(LogModule.DB, `Deleting proxy with ID: ${_id}`);
  proxyDB.remove({ _id: _id }, (err, n) => {
    if (err) {
      logError(LogModule.DB, `Error deleting proxy: ${err.message}`);
    } else {
      logInfo(
        LogModule.DB,
        `Proxy deleted successfully. Number of documents removed: ${n}`
      );
    }
    if (cb) cb(err, n);
  });
};

export const updateProxyById = (
  proxy: Proxy,
  cb?: (err: Error | null, numberOfUpdated: number, upsert: boolean) => void
) => {
  logDebug(`修改代理：${proxy}`);
  logInfo(LogModule.DB, `Updating proxy: ${JSON.stringify(proxy)}`);
  proxyDB.update(
    { _id: proxy._id },
    proxy,
    {},
    (err, numberOfUpdated, upsert) => {
      if (err) {
        logError(LogModule.DB, `Error updating proxy: ${err.message}`);
      } else {
        logInfo(
          LogModule.DB,
          `Proxy updated successfully. Updated: ${numberOfUpdated}, Upsert: ${upsert}`
        );
      }
      if (cb) cb(err, numberOfUpdated, upsert);
    }
  );
};

export const listProxy = (
  callback: (err: Error | null, documents: Proxy[]) => void
) => {
  logInfo(LogModule.DB, `Listing all proxies`);
  proxyDB.find({}, (err, documents) => {
    if (err) {
      logError(LogModule.DB, `Error listing proxies: ${err.message}`);
    } else {
      logInfo(
        LogModule.DB,
        `Proxies listed successfully. Count: ${documents.length}`
      );
    }
    callback(err, documents);
  });
};

export const getProxyById = (
  id: string,
  callback: (err: Error | null, document: Proxy) => void
) => {
  logInfo(LogModule.DB, `Getting proxy by ID: ${id}`);
  proxyDB.findOne({ _id: id }, (err, document) => {
    if (err) {
      logError(LogModule.DB, `Error getting proxy by ID: ${err.message}`);
    } else {
      logInfo(
        LogModule.DB,
        `Proxy retrieved successfully: ${JSON.stringify(document)}`
      );
    }
    callback(err, document);
  });
};

export const clearProxy = (cb?: (err: Error | null, n: number) => void) => {
  logInfo(LogModule.DB, `Clearing all proxies`);
  proxyDB.remove({}, { multi: true }, (err, n) => {
    if (err) {
      logError(LogModule.DB, `Error clearing proxies: ${err.message}`);
    } else {
      logInfo(
        LogModule.DB,
        `Proxies cleared successfully. Number of documents removed: ${n}`
      );
    }
    if (cb) cb(err, n);
  });
};

export const updateProxyStatus = (
  id: string,
  st: boolean,
  cb?: (err: Error | null, numberOfUpdated: number, upsert: boolean) => void
) => {
  logInfo(LogModule.DB, `Updating proxy status for ID: ${id} to ${st}`);
  proxyDB.update(
    { _id: id },
    { $set: { status: st } },
    {},
    (err, numberOfUpdated, upsert) => {
      if (err) {
        logError(
          LogModule.DB,
          `Error updating proxy status: ${err.message}`
        );
      } else {
        logInfo(
          LogModule.DB,
          `Proxy status updated successfully. Updated: ${numberOfUpdated}, Upsert: ${upsert}`
        );
      }
      if (cb) cb(err, numberOfUpdated, upsert);
    }
  );
};
