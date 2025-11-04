import admZip from "adm-zip";
import { app, BrowserWindow, net, shell } from "electron";
import BeanFactory from "../core/BeanFactory";

import fs from "fs";
import path from "path";
import * as tar from "tar";
import zlib from "zlib";
import GlobalConstant from "../core/GlobalConstant";
import Logger from "../core/Logger";
import ResponseUtils from "../utils/ResponseUtils";

class SystemService {
  async openUrl(url: string) {
    if (url) {
      await shell.openExternal(url);
    }
  }

  async relaunch() {
    await app.relaunch();
    app.quit();
  }

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

  checkInternetConnect() {
    return new Promise(resolve => {
      const request = net.request({
        method: "get",
        url: ``
      });
      const timeout = setTimeout(() => {
        request.abort();
        resolve(false);
      }, GlobalConstant.INTERNET_CHECK_TIMEOUT * 1000);
      request.on("response", response => {
        resolve(response.statusCode === 200);
      });
      request.on("error", error => {
        resolve(false);
      });
      request.end();
    });
  }

  getSystemUsage(listenerParam: ListenerParam) {
    const process = require("process");
    const os = require("os");
    // const { event, channel } = listenerParam;
    let lastCpuUsage = process.cpuUsage();
    let lastTime = Date.now();

    setInterval(() => {
      // 获取内存使用情况
      const memoryUsage = process.memoryUsage();
      // const totalMemory = os.totalmem();
      const usedMemory = memoryUsage.rss; // 实际物理内存使用量
      // const memoryPercentage = ((usedMemory / totalMemory) * 100).toFixed(2);

      // 获取当前 Electron 进程的 CPU 使用情况
      const currentTime = Date.now();
      const currentCpuUsage = process.cpuUsage();

      // 计算时间差（毫秒转微秒）
      const timeDiff = (currentTime - lastTime) * 1000;

      // 计算CPU使用时间差（微秒）
      const userCPUTimeDiff = currentCpuUsage.user - lastCpuUsage.user;
      const systemCPUTimeDiff = currentCpuUsage.system - lastCpuUsage.system;
      const totalCPUTimeDiff = userCPUTimeDiff + systemCPUTimeDiff;

      // 计算当前Electron进程的CPU使用率百分比
      const cpuPercentage =
        timeDiff > 0
          ? ((totalCPUTimeDiff / timeDiff) * 100).toFixed(2)
          : "0.00";

      // 更新上次的值
      lastCpuUsage = currentCpuUsage;
      lastTime = currentTime;

      const result = {
        cpu: parseFloat(cpuPercentage),
        memory: {
          used: Math.round(usedMemory / 1024 / 1024) // MB
          // percentage: parseFloat(memoryPercentage)
        }
      };

      Logger.debug("SystemService.getSystemUsage", JSON.stringify(result));

      const win: BrowserWindow = BeanFactory.getBean("win");
      if (win && !win.isDestroyed()) {
        win.webContents.send(
          listenerParam.channel,
          ResponseUtils.success(result)
        );
      }
    }, 1000);
  }
}

export default SystemService;
