import fs from "fs";
import path from "path";
import { app, BrowserWindow } from "electron";
import FileService from "./FileService";
import { success } from "../utils/response";

class LogService {
  private readonly _fileService: FileService;
  private readonly _logPath: string = path.join(
    app.getPath("userData"),
    "frpc.log"
  );

  constructor(fileService: FileService) {
    this._fileService = fileService;
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

  watchFrpcLog(win: BrowserWindow) {
    fs.watch(this._logPath, (eventType, filename) => {
      if (eventType === "change") {
        win.webContents.send(
          "log/watchFrpcLogContent.hook",
          success(true)
        )
      } else {
      }
    });
    // return new Promise<boolean>((resolve, reject) => {
    //
    // });
  }

  openFrpcLogFile(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this._fileService
        .openFile(this._logPath)
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
