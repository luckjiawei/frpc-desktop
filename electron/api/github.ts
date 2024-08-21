import electron, { app, BrowserWindow, ipcMain, net, shell } from "electron";
import {
  deleteVersionById,
  insertVersion,
  listVersion
} from "../storage/version";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { download } = require("electron-dl");
const AdmZip = require("adm-zip");
const log = require("electron-log");

const versionRelation = {
  win32_x64: ["window", "amd64"],
  win32_arm64: ["window", "arm64"],
  win32_ia32: ["window", "386"],
  darwin_arm64: ["darwin", "arm64"],
  darwin_x64: ["darwin", "amd64"],
  darwin_amd64: ["darwin", "amd64"],
  linux_x64: ["linux", "amd64"],
  linux_arm64: ["linux", "arm64"]
};
const platform = process.platform;
const arch = process.arch;
let currArch = `${platform}_${arch}`;
const frpArch = versionRelation[currArch];

const unTarGZ = (tarGzPath: string, targetPath: string) => {
  const tar = require("tar");
  const unzip = zlib.createGunzip();
  log.debug(`开始解压tar.gz：${tarGzPath} 目标目录：${targetPath}`);
  const readStream = fs.createReadStream(tarGzPath);
  if (!fs.existsSync(unzip)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  readStream.pipe(unzip).pipe(
    tar.extract({
      cwd: targetPath,
      filter: filePath => path.basename(filePath) === "frpc"
    })
  );
  const frpcPath = path.join("frp", path.basename(tarGzPath, ".tar.gz"));
  log.debug(`解压完成 解压后目录：${frpcPath}`);
  return frpcPath;
  // .on("finish", () => {
  //   console.log("解压完成！");
  // });
};

const unZip = (zipPath: string, targetPath: string) => {
  if (!fs.existsSync(path.join(targetPath, path.basename(zipPath, ".zip")))) {
    fs.mkdirSync(path.join(targetPath, path.basename(zipPath, ".zip")), {
      recursive: true
    });
  }
  log.debug(`开始解压zip：${zipPath} 目标目录：${targetPath}`);
  /**
   * unzipper解压
   */
  // fs.createReadStream(zipPath)
  //     .pipe(unzipper.Extract({ path: targetPath }))
  //     // 只解压frpc.exe
  //     // .pipe(unzipper.ParseOne('frpc'))
  //     // .pipe(fs.createWriteStream(path.join(targetPath, path.basename(zipPath, ".zip"), "frpc.exe")))
  //     .on('finish', () => {
  //         console.log('File extracted successfully.');
  //     })
  //     .on('error', (err) => {
  //         console.error('Error extracting file:', err);
  //     });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetPath, true); // 第二个参数为 true，表示覆盖已存在的文件
  const frpcPath = path.join("frp", path.basename(zipPath, ".zip"));
  log.debug(`解压完成 解压后目录：${frpcPath}`);
  return frpcPath;
};

export const initGitHubApi = () => {
  // 版本
  let versions: FrpVersion[] = [];

  const getVersion = versionId => {
    return versions.find(f => f.id === versionId);
  };

  const getAdaptiveAsset = versionId => {
    const { assets } = getVersion(versionId);
    const asset = assets.find(f => {
      // const a = versionRelation[currArch]
      const a = frpArch;
      if (a) {
        const flag = a.every(item => f.name.includes(item));
        return flag;
      }
      return false;
    });
    if (asset) {
      log.info(`找到对应版本 ${asset.name}`);
    }
    return asset;
  };

  const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024; // 1 KB = 1024 Bytes
    const dm = decimals < 0 ? 0 : decimals; // 确保小数位数不小于 0
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k)); // 计算单位索引
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]; // 返回格式化的字符串
  };

  /**
   * 获取github上的frp所有版本
   */
  ipcMain.on("github.getFrpVersions", async event => {
    const request = net.request({
      method: "get",
      url: "https://api.github.com/repos/fatedier/frp/releases?page=1&per_page=1000"
    });
    request.on("response", response => {
      let responseData: Buffer = Buffer.alloc(0);
      response.on("data", (data: Buffer) => {
        responseData = Buffer.concat([responseData, data]);
      });
      response.on("end", () => {
        versions = JSON.parse(responseData.toString());
        // const borderContent: Electron.WebContents =
        //   BrowserWindow.getFocusedWindow().webContents;
        const downloadPath = path.join(app.getPath("userData"), "download");
        log.info(
          `开始获取frp版本 当前架构：${currArch} 对应frp架构：${frpArch}`
        );
        const returnVersionsData = versions
          .filter(f => getAdaptiveAsset(f.id))
          .map(m => {
            const asset = getAdaptiveAsset(m.id);
            const download_count = m.assets.reduce(
              (sum, item) => sum + item.download_count,
              0
            );
            if (asset) {
              const absPath = `${downloadPath}/${asset.name}`;
              m.absPath = absPath;
              m.download_completed = fs.existsSync(absPath);
              m.download_count = download_count;
              m.size = formatBytes(asset.size);
            }
            return m;
          });
        // log.debug(`获取到frp版本：${JSON.stringify(returnVersionsData)}`)
        event.reply("Download.frpVersionHook", returnVersionsData);
      });
    });
    request.end();
  });

  /**
   * 下载请求
   */
  ipcMain.on("github.download", async (event, args) => {
    const { versionId, mirror } = args;
    const version = getVersion(versionId);
    const asset = getAdaptiveAsset(versionId);
    const { browser_download_url } = asset;

    let url = browser_download_url;
    if (mirror === "ghproxy") {
      url = "https://mirror.ghproxy.com/" + url;
    }

    log.info(`开始下载frp url：${url} asset：${asset.name}`);
    // 数据目录
    await download(BrowserWindow.getFocusedWindow(), url, {
      filename: `${asset.name}`,
      directory: path.join(app.getPath("userData"), "download"),
      onProgress: progress => {
        event.reply("Download.frpVersionDownloadOnProgress", {
          id: versionId,
          progress: progress
        });
      },
      onCompleted: () => {
        log.info(`frp下载完成 url：${url} asset：${asset.name}`);
        const targetPath = path.resolve(
          path.join(app.getPath("userData"), "frp")
        );
        const ext = path.extname(asset.name);
        let frpcVersionPath = "";
        if (ext === ".zip") {
          frpcVersionPath = unZip(
            path.join(
              path.join(app.getPath("userData"), "download"),
              `${asset.name}`
            ),
            targetPath
          );
        } else if (ext === ".gz" && asset.name.includes(".tar.gz")) {
          frpcVersionPath = unTarGZ(
            path.join(
              path.join(app.getPath("userData"), "download"),
              `${asset.name}`
            ),
            targetPath
          );
        }

        version["frpcVersionPath"] = frpcVersionPath;
        insertVersion(version, (err, document) => {
          if (!err) {
            listVersion((err, doc) => {
              event.reply("Config.versions.hook", { err, data: doc });
              event.reply("Download.frpVersionDownloadOnCompleted", versionId);
              version.download_completed = true;
            });
          }
        });
      }
    });
  });

  /**
   * 删除下载
   */
  ipcMain.on("github.deleteVersion", async (event, args) => {
    const { absPath, id } = args;
    if (fs.existsSync(absPath)) {
      deleteVersionById(id, () => {
        fs.unlinkSync(absPath);
      });
    }
    listVersion((err, doc) => {
      event.reply("Config.versions.hook", { err, data: doc });
      event.reply("Download.deleteVersion.hook", {
        err: null,
        data: "删除成功"
      });
    });
  });

  /**
   * 获取最后版本
   */
  ipcMain.on("github.getFrpcDesktopLastVersions", async event => {
    const request = net.request({
      method: "get",
      url: "https://api.github.com/repos/luckjiawei/frpc-desktop/releases/latest"
    });
    request.on("response", response => {
      let responseData: Buffer = Buffer.alloc(0);
      response.on("data", (data: Buffer) => {
        responseData = Buffer.concat([responseData, data]);
      });
      response.on("end", () => {
        versions = JSON.parse(responseData.toString());
        // const borderContent: Electron.WebContents =
        //   BrowserWindow.getFocusedWindow().webContents;
        // const downloadPath = path.join(app.getPath("userData"), "download");
        // log.info(`开始获取frp版本 当前架构：${currArch} 对应frp架构：${frpArch}`)
        // const returnVersionsData = versions
        //     .filter(f => getAdaptiveAsset(f.id))
        //     .map(m => {
        //         const asset = getAdaptiveAsset(m.id);
        //         if (asset) {
        //             const absPath = `${downloadPath}/${asset.name}`;
        //             m.absPath = absPath;
        //             m.download_completed = fs.existsSync(absPath);
        //         }
        //         return m;
        //     });
        // log.debug(`获取到frp版本：${JSON.stringify(returnVersionsData)}`)
        event.reply("github.getFrpcDesktopLastVersionsHook", versions);
      });
    });
    request.end();
  });
};
