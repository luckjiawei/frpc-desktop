import fs from "fs";
import { success } from "../utils/response";
import PathUtils from "../utils/PathUtils";
import SystemService from "./SystemService";

class LogService {
  private readonly _systemService: SystemService;
  private readonly _logPath: string = PathUtils.getFrpcLogFilePath();

  constructor(systemService: SystemService) {
    this._systemService = systemService;
  }

  getFrpLogContent(): Promise<string> {
    return new Promise((resolve, reject) => {
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
    console.log('watchFrpcLog succcess');
    fs.watch(this._logPath, (eventType, filename) => {
      if (eventType === "change") {
        console.log("change", eventType, listenerParam.channel);
        listenerParam.win.webContents.send(
          listenerParam.channel,
          success(true)
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
