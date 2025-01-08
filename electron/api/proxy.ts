import { ipcMain } from "electron";
import {
  deleteProxyById,
  getProxyById,
  insertProxy,
  listProxy,
  updateProxyById,
  updateProxyStatus
} from "../storage/proxy";
import { reloadFrpcProcess } from "./frpc";
import { logError, logInfo, LogModule, logWarn } from "../utils/log";
export const initProxyApi = () => {
  ipcMain.on("proxy.getProxys", async (event, args) => {
    logInfo(LogModule.APP, "Requesting to get proxies.");
    listProxy((err, documents) => {
      if (err) {
        logError(LogModule.APP, `Error retrieving proxies: ${err.message}`);
      } else {
        logInfo(LogModule.APP, "Proxies retrieved successfully.");
      }
      event.reply("Proxy.getProxys.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.insertProxy", async (event, args) => {
    delete args["_id"];
    logInfo(LogModule.APP, "Inserting a new proxy.");
    insertProxy(args, (err, documents) => {
      if (err) {
        logError(LogModule.APP, `Error inserting proxy: ${err.message}`);
      } else {
        logInfo(LogModule.APP, "Proxy inserted successfully.");
        reloadFrpcProcess();
      }
      event.reply("Proxy.insertProxy.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.deleteProxyById", async (event, args) => {
    logInfo(LogModule.APP, `Deleting proxy with ID: ${args._id}`);
    deleteProxyById(args, (err, documents) => {
      if (err) {
        logError(LogModule.APP, `Error deleting proxy: ${err.message}`);
      } else {
        logInfo(LogModule.APP, "Proxy deleted successfully.");
        reloadFrpcProcess();
      }
      event.reply("Proxy.deleteProxyById.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.getProxyById", async (event, args) => {
    logInfo(LogModule.APP, `Requesting proxy with ID: ${args._id}`);
    getProxyById(args, (err, documents) => {
      if (err) {
        logError(LogModule.APP, `Error retrieving proxy: ${err.message}`);
      } else {
        logInfo(LogModule.APP, "Proxy retrieved successfully.");
      }
      event.reply("Proxy.getProxyById.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.updateProxy", async (event, args) => {
    if (!args._id) {
      logWarn(LogModule.APP, "No proxy ID provided for update.");
      return;
    }
    logInfo(LogModule.APP, `Updating proxy with ID: ${args._id}`);
    updateProxyById(args, (err, documents) => {
      if (err) {
        logError(LogModule.APP, `Error updating proxy: ${err.message}`);
      } else {
        logInfo(LogModule.APP, "Proxy updated successfully.");
        reloadFrpcProcess();
      }
      event.reply("Proxy.updateProxy.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.updateProxyStatus", async (event, args) => {
    logInfo(LogModule.APP, `Updating status for proxy ID: ${args._id}`);
    if (!args._id) {
      logWarn(LogModule.APP, "No proxy ID provided for status update.");
      return;
    }
    updateProxyStatus(args._id, args.status, (err, documents) => {
      if (err) {
        logError(LogModule.APP, `Error updating proxy status: ${err.message}`);
      } else {
        logInfo(LogModule.APP, "Proxy status updated successfully.");
        reloadFrpcProcess();
      }
      event.reply("Proxy.updateProxyStatus.hook", {
        err: err,
        data: documents
      });
    });
  });
};
