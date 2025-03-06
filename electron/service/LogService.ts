import fs from "fs";
import PathUtils from "../utils/PathUtils";
import SystemService from "./SystemService";
import BeanFactory from "../core/BeanFactory";
import { BrowserWindow } from "electron";
import ResponseUtils from "../utils/ResponseUtils";

class LogService {
  private readonly _systemService: SystemService;
  private readonly _logPath: string = PathUtils.getFrpcLogFilePath();

  constructor(systemService: SystemService) {
    this._systemService = systemService;
  }

  async getFrpLogContent() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this._logPath)) {
        resolve("");
      }
      fs.readFile(this._logPath, "utf-8", (error, data) => {
        if (!error) {
          resolve(data);
        } else {
          reject(error);
        }
      });
    });
  }

  watchFrpcLog(listenerParam: ListenerParam) {
    if (!fs.existsSync(this._logPath)) {
      setTimeout(() => this.watchFrpcLog(listenerParam), 1000);
      return;
    }
    console.log("watchFrpcLog succcess");
    fs.watch(this._logPath, (eventType, filename) => {
      if (eventType === "change") {
        console.log("change", eventType, listenerParam.channel);
        const win: BrowserWindow = BeanFactory.getBean("win");
        win.webContents.send(
          listenerParam.channel,
          ResponseUtils.success(true)
        );
      } else {
      }
    });
    // return new Promise<boolean>((resolve, reject) => {
    //
    // });
  }

  openFrpcLogFile(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this._systemService
        .openLocalFile(this._logPath)
        .then(result => {
          resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }
}

export default LogService;
