import "reflect-metadata";
import admZip from "adm-zip";
import { app, BrowserWindow, net, shell } from "electron";

import fs from "fs";
import path from "path";
import * as tar from "tar";
import zlib from "zlib";
import { GlobalConstant } from "../core/constant";
import { inject, injectable, Container } from "inversify";
import { TYPES } from "../di";

@injectable()
export default class SystemService {
  private readonly _container: Container;

  // CPU 监控相关的状态变量
  private lastCpuUsage: NodeJS.CpuUsage;
  private lastTime: number;

  constructor(@inject(TYPES.Container) container: Container) {
    this._container = container;
    this.lastCpuUsage = process.cpuUsage();
    this.lastTime = Date.now();
  }

  /**
   * Open url to browser
   * @param url url 
   */
  public async openUrl(url: string) {
    if (url) {
      await shell.openExternal(url);
    }
  }

  /**
   * Relaunch app
   */
  async relaunch() {
    await app.relaunch();
    app.quit();
  }

  /**
   * Open local file
   * @param filePath file path
   */
  openLocalFile(filePath: string) {
    return new Promise<boolean>((resolve, reject) => {
      shell
        .openPath(filePath)
        .then(errorMessage => {
          if (errorMessage) {
            resolve(false);
          } else {
            resolve(true);
          }
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  /**
   * Open local path
   * @param path path
   * @returns open result
   */
  openLocalPath(path: string) {
    return new Promise<boolean>((resolve, reject) => {
      shell.openPath(path).then(errorMessage => {
        if (errorMessage) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Decompress zip file
   * @param zipFilePath zip file path
   * @param targetPath target path
   */
  decompressZipFile(zipFilePath: string, targetPath: string) {
    if (!zipFilePath.endsWith(GlobalConstant.ZIP_EXT)) {
      throw new Error("The file is not a .zip file");
    }
    if (!fs.existsSync(zipFilePath)) {
      throw new Error("The file does not exist");
    }
    // const zipBasename = path.basename(zipFilePath, GlobalConstant.ZIP_EXT);
    const targetFolder = path.join(targetPath, targetPath);
    if (!fs.existsSync) {
      // not exists. do mkdir
      fs.mkdirSync(targetFolder, {
        recursive: true
      });
    }
    // starting unzip.
    // let frpcEntry = null;
    const zip = new admZip(zipFilePath);
    // if (process.platform === "win32") {
    //   frpcEntry = zip.getEntry("frpc.exe");
    // } else {
    //   frpcEntry = zip.getEntry("frpc");
    // }
    //
    // zip.extractEntryTo(frpcEntry, targetPath, false, true);
    zip.extractAllTo(targetPath, true); // true: cover exists file.
    // todo 2025-02-21 return targetPath.
    // const frpcPath = path.join("frp", path.basename(zipFilePath, zipExt));
  }

  /**
   * Decompress tar.gz file
   * @param tarGzPath tar.gz file path
   * @param targetPath target path
   * @param finish finish callback
   */
  decompressTarGzFile(tarGzPath: string, targetPath: string, finish: Function) {
    // const targetFolder = path.join(targetPath, targetPath);
    const unzip = zlib.createGunzip();
    const readStream = fs.createReadStream(tarGzPath);
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true, mode: 0o777 });
    }

    readStream
      .pipe(unzip)
      .on("error", err => {
        // logError(LogModule.APP, `Error during gunzip: ${err.message}`);
      })
      .pipe(
        tar
          .extract({
            cwd: targetPath,
            strip: 1,
            filter: filePath => path.basename(filePath) === "frpc"
          })
          .on("error", err => {
            // logError(
            //   LogModule.APP,
            //   `Error extracting tar file: ${err.message}`
            // );
          })
      )
      .on("finish", () => {
        finish();
        // const frpcPath = path.join("frp", path.basename(tarGzPath, ".tar.gz"));
        // logInfo(
        //   LogModule.APP,
        //   `Extraction completed. Extracted directory: ${frpcPath}`
        // );
      });
  }

  /**
   * Check internet connect
   * @returns check result
   */
  async checkInternetConnect(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const request = net.request({
        method: "get",
        url: `http://conntest.nintendowifi.net/`,
      });

      // 添加超时处理
      const timeout = setTimeout(() => {
        request.abort();
        resolve(false);
      }, GlobalConstant.INTERNET_CHECK_TIMEOUT * 1000);

      request.on("response", response => {
        clearTimeout(timeout);
        if (response.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      request.on("error", error => {
        clearTimeout(timeout);
        resolve(false);
      });

      // 发送请求 - 这是必须的！
      request.end();
    });
  }

  /**
   * Get system usage
   * @returns system usage
   */
  public getSystemUsage() {
    const os = require("os");

    // 获取内存使用情况
    const memoryUsage = process.memoryUsage();
    const usedMemory = memoryUsage.rss; // 实际物理内存使用量

    // 获取当前 Electron 进程的 CPU 使用情况
    const currentTime = Date.now();
    const currentCpuUsage = process.cpuUsage();

    // 计算时间差（毫秒转微秒）
    const timeDiff = (currentTime - this.lastTime) * 1000;

    // 计算CPU使用时间差（微秒）
    const userCPUTimeDiff = currentCpuUsage.user - this.lastCpuUsage.user;
    const systemCPUTimeDiff = currentCpuUsage.system - this.lastCpuUsage.system;
    const totalCPUTimeDiff = userCPUTimeDiff + systemCPUTimeDiff;

    // 计算当前Electron进程的CPU使用率百分比
    const cpuPercentage =
      timeDiff > 0
        ? ((totalCPUTimeDiff / timeDiff) * 100).toFixed(2)
        : "0.00";

    // 更新上次的值（保存到实例变量）
    this.lastCpuUsage = currentCpuUsage;
    this.lastTime = currentTime;

    const result = {
      cpu: parseFloat(cpuPercentage),
      memory: {
        used: Math.round(usedMemory / 1024 / 1024) // MB
      }
    };

    return result;
  }
}