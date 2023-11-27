import { app, BrowserWindow, ipcMain, net } from "electron";
import { insertVersion } from "../storage/version";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { download } = require("electron-dl");

const unTarGZ = tarGzPath => {
  const tar = require("tar");
  const targetPath = path.resolve(path.join(app.getPath("userData"), "frp"));
  const unzip = zlib.createGunzip();
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
  return path.join("frp", path.basename(tarGzPath, ".tar.gz"));
  // .on("finish", () => {
  //   console.log("解压完成！");
  // });
};
export const initGitHubApi = () => {
  // 版本
  let versions = [];

  const getVersion = versionId => {
    return versions.find(f => f.id === versionId);
  };

  const getAdaptiveAsset = versionId => {
    const version = getVersion(versionId);
    const arch = process.arch;
    const platform = process.platform;
    const { assets } = version;
    const asset = assets.find(
      f => f.name.indexOf(platform) != -1 && f.name.indexOf(arch) != -1
    );
    return asset;
  };

  /**
   * 获取github上的frp所有版本
   */
  ipcMain.on("github.getFrpVersions", async event => {
    const request = net.request({
      method: "get",
      url: "https://api.github.com/repos/fatedier/frp/releases"
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
        const returnVersionsData = versions
          .filter(f => getAdaptiveAsset(f.id))
          .map(m => {
            const asset = getAdaptiveAsset(m.id);
            if (asset) {
              // const absPath = `${downloadPath}/${asset.id}_${asset.name}`;
              const absPath = `${downloadPath}/${asset.name}`;
              m.download_completed = fs.existsSync(absPath);
            } else {
              console.log("buzhicih");
            }
            // m.download_completed = fs.existsSync(
            //   `${downloadPath}/${asset.id}_${asset.name}`
            // );
            return m;
          });
        event.reply("Download.frpVersionHook", returnVersionsData);
      });
    });
    request.end();
  });

  /**
   * 下载请求
   */
  ipcMain.on("github.download", async (event, args) => {
    const version = getVersion(args);
    const asset = getAdaptiveAsset(args);
    const { browser_download_url } = asset;
    // 数据目录
    await download(BrowserWindow.getFocusedWindow(), browser_download_url, {
      filename: `${asset.name}`,
      directory: path.join(app.getPath("userData"), "download"),
      onProgress: progress => {
        event.reply("Download.frpVersionDownloadOnProgress", {
          id: args,
          progress: progress
        });
      },
      onCompleted: () => {
        const frpcVersionPath = unTarGZ(
          path.join(
            path.join(app.getPath("userData"), "download"),
            `${asset.name}`
          )
        );
        version["frpcVersionPath"] = frpcVersionPath;
        insertVersion(version, (err, document) => {
          if (!err) {
            event.reply("Download.frpVersionDownloadOnCompleted", args);
            version.download_completed = true;
          }
        });
      }
    });
  });
};
