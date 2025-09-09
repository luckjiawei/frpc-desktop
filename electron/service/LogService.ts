import { BrowserWindow } from "electron";
import fs from "fs";
import BeanFactory from "../core/BeanFactory";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import SystemService from "./SystemService";

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

  private _watcher: fs.FSWatcher | null = null;

  watchFrpcLog(listenerParam: ListenerParam) {
    // 如果已存在watcher,先清理掉旧的
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }

    if (!fs.existsSync(this._logPath)) {
      const timer = setTimeout(() => {
        this.watchFrpcLog(listenerParam);
        clearTimeout(timer);
      }, 1000);
      return;
    }

    this._watcher = fs.watch(this._logPath, (eventType, filename) => {
      if (eventType === "change") {
        const win: BrowserWindow = BeanFactory.getBean("win");
        win.webContents.send(
          listenerParam.channel,
          ResponseUtils.success(true)
        );
      }
    });
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
