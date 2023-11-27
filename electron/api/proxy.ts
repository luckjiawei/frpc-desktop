import { ipcMain } from "electron";
import {
  deleteProxyById,
  getProxyById,
  insertProxy,
  listProxy,
  updateProxyById
} from "../storage/proxy";
import { reloadFrpcProcess } from "./frpc";



export const initProxyApi = () => {
  ipcMain.on("proxy.getProxys", async (event, args) => {
    listProxy((err, documents) => {
      event.reply("Proxy.getProxys.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.insertProxy", async (event, args) => {
    delete args["_id"];
    insertProxy(args, (err, documents) => {
      if (!err) {
        reloadFrpcProcess()
      }
      event.reply("Proxy.insertProxy.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.deleteProxyById", async (event, args) => {
    deleteProxyById(args, (err, documents) => {
      if (!err) {
        reloadFrpcProcess()
      }
      event.reply("Proxy.deleteProxyById.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.getProxyById", async (event, args) => {
    getProxyById(args, (err, documents) => {
      event.reply("Proxy.getProxyById.hook", {
        err: err,
        data: documents
      });
    });
  });

  ipcMain.on("proxy.updateProxy", async (event, args) => {
    if (!args._id) return;
    updateProxyById(args, (err, documents) => {
      if (!err) {
        reloadFrpcProcess()
      }
      event.reply("Proxy.updateProxy.hook", {
        err: err,
        data: documents
      });
    });
  });
};
