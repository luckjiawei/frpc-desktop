import { BrowserWindow } from "electron";
import fs from "fs";
import BeanFactory from "../core/BeanFactory";
import PathUtils from "../utils/PathUtils";
import ResponseUtils from "../utils/ResponseUtils";
import SystemService from "./SystemService";

const LOG_TAIL_BYTES = 512 * 1024;
const LOG_MAX_LINES = 2000;

class LogService {
  private readonly _systemService: SystemService;
  private readonly _appPath: string = PathUtils.getAppLogFilePath();

  constructor(systemService: SystemService) {
    this._systemService = systemService;
  }

  private getFrpcLogPath(serverId = "1") {
    return PathUtils.getFrpcLogFilePathByServerId(serverId);
  }

  async getFrpLogContent(serverId = "1") {
    return new Promise((resolve, reject) => {
      const logPath = this.getFrpcLogPath(serverId);
      if (!fs.existsSync(logPath)) {
        resolve("");
        return;
      }
      try {
        const data = this.readTailText(logPath);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getAppLogContent() {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this._appPath)) {
        resolve("");
        return;
      }
      try {
        const data = this.readTailText(this._appPath);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
  }

  private readTailText(filePath: string) {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return "";
    }

    const readSize = Math.min(stat.size, LOG_TAIL_BYTES);
    const start = stat.size - readSize;
    const buffer = Buffer.alloc(readSize);
    const fd = fs.openSync(filePath, "r");

    try {
      fs.readSync(fd, buffer, 0, readSize, start);
    } finally {
      fs.closeSync(fd);
    }

    let text = buffer.toString("utf-8");
    if (start > 0) {
      const firstLineBreak = text.indexOf("\n");
      text = firstLineBreak === -1 ? "" : text.slice(firstLineBreak + 1);
    }

    const lines = text.split("\n");
    return lines.slice(Math.max(lines.length - LOG_MAX_LINES, 0)).join("\n");
  }

  private _watcher: fs.FSWatcher | null = null;

  watchFrpcLog(listenerParam: ListenerParam) {
    // 如果已存在watcher,先清理掉旧的
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }

    const logPath = this.getFrpcLogPath();
    if (!fs.existsSync(logPath)) {
      const timer = setTimeout(() => {
        this.watchFrpcLog(listenerParam);
        clearTimeout(timer);
      }, 1000);
      return;
    }

    this._watcher = fs.watch(logPath, (eventType, filename) => {
      if (eventType === "change") {
        const win: BrowserWindow = BeanFactory.getBean("win");
        if (win && !win.isDestroyed()) {
          win.webContents.send(
            listenerParam.channel,
            ResponseUtils.success(true)
          );
        }
      }
    });
  }

  openFrpcLogFile(serverId = "1"): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this._systemService
        .openLocalFile(this.getFrpcLogPath(serverId))
        .then(result => {
          resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

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
