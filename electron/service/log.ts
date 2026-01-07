import "reflect-metadata";
import { BrowserWindow } from "electron";
import fs from "fs";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import SystemService from "./SystemService";
import { injectable, inject, Container } from "inversify";
import { TYPES } from "../di";

@injectable()
class LogService {
  private readonly _systemService: SystemService;
  private readonly _logPath: string = PathUtils.getFrpcLogFilePath();
  private readonly _appPath: string = PathUtils.getAppLogFilePath();
  private readonly _container: Container;

  constructor(
    @inject(TYPES.SystemService) systemService: SystemService,
    @inject(TYPES.Container) container: Container
  ) {
    this._systemService = systemService;
    this._container = container;
  }

  /**
   * Get frpc log content
   * @returns frpc log content
   */
  public async getFrpLogContent() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this._logPath)) {
        resolve("");
        return;
      }
      try {
        const data = fs.readFileSync(this._logPath, "utf-8");
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get app log content
   * @returns app log content
   */
  public async getAppLogContent() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this._appPath)) {
        resolve("");
        return;
      }
      try {
        const data = fs.readFileSync(this._appPath, "utf-8");
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Open frpc log file
   * @returns open result
   */
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

  /**
   * Open app log file
   * @returns open result
   */
  openAppLogFile(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this._systemService
        .openLocalFile(this._appPath)
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
