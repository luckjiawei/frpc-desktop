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
import frpReleasesJson from "../json/frp-releases.json";
import { logInfo, logError, LogModule, logDebug, logWarn } from "../utils/log";

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
  logInfo(
    LogModule.APP,
    `Starting to extract tar.gz: ${tarGzPath} to ${targetPath}`
  );

  const readStream = fs.createReadStream(tarGzPath);
  if (!fs.existsSync(unzip)) {
    fs.mkdirSync(targetPath, { recursive: true });
    logInfo(LogModule.APP, `Created target directory: ${targetPath}`);
  }

  readStream.on("error", err => {
    logError(LogModule.APP, `Error reading tar.gz file: ${err.message}`);
  });

  readStream
    .pipe(unzip)
    .on("error", err => {
      logError(LogModule.APP, `Error during gunzip: ${err.message}`);
    })
    .pipe(
      tar
        .extract({
          cwd: targetPath,
          filter: filePath => path.basename(filePath) === "frpc"
        })
        .on("error", err => {
          logError(LogModule.APP, `Error extracting tar file: ${err.message}`);
        })
    )
    .on("finish", () => {
      const frpcPath = path.join("frp", path.basename(tarGzPath, ".tar.gz"));
      logInfo(
        LogModule.APP,
        `Extraction completed. Extracted directory: ${frpcPath}`
      );
    });

  return path.join("frp", path.basename(tarGzPath, ".tar.gz"));
};

const unZip = (zipPath: string, targetPath: string) => {
  if (!fs.existsSync(path.join(targetPath, path.basename(zipPath, ".zip")))) {
    fs.mkdirSync(path.join(targetPath, path.basename(zipPath, ".zip")), {
      recursive: true
    });
    logInfo(LogModule.APP, `Created target directory: ${targetPath}`);
    logInfo(
      LogModule.APP,
      `Created directory for zip extraction: ${path.basename(zipPath, ".zip")}`
    );
  }

  logDebug(
    LogModule.APP,
    `Starting to unzip: ${zipPath} to target directory: ${targetPath}`
  );
  logInfo(LogModule.APP, `Starting to extract zip file: ${zipPath}`);

  const zip = new AdmZip(zipPath);
  try {
    zip.extractAllTo(targetPath, true); // 第二个参数为 true，表示覆盖已存在的文件
    const frpcPath = path.join("frp", path.basename(zipPath, ".zip"));
    logInfo(
      LogModule.APP,
      `Extraction completed. Extracted directory: ${frpcPath}`
    );
    logDebug(
      LogModule.APP,
      `Unzip completed. Extracted directory: ${frpcPath}`
    );
    return frpcPath;
  } catch (error) {
    logError(LogModule.APP, `Error extracting zip file: ${error.message}`);
  }

  return null;
};

export const initGitHubApi = () => {
  // 版本
  let versions: FrpVersion[] = [];

  const getVersion = versionId => {
    logDebug(
      LogModule.GITHUB,
      `Attempting to get version with ID: ${versionId}`
    );
    const version = versions.find(f => f.id === versionId);
    if (version) {
      logInfo(LogModule.GITHUB, `Version found: ${JSON.stringify(version)}`);
    } else {
      logWarn(LogModule.GITHUB, `No version found for ID: ${versionId}`);
    }
    return version;
  };

  const getAdaptiveAsset = versionId => {
    const { assets } = getVersion(versionId);
    if (!assets || assets.length === 0) {
      logWarn(LogModule.GITHUB, `No assets found for version ID: ${versionId}`);
      return null;
    }

    const asset = assets.find(f => {
      const a = frpArch;
      if (a) {
        const flag = a.every(item => f.name.includes(item));
        if (flag) {
          logInfo(
            LogModule.GITHUB,
            `Found matching asset: ${f.name} for version ID: ${versionId}`
          );
        }
        return flag;
      }
      logWarn(
        LogModule.GITHUB,
        `No architecture match found for asset: ${f.name}`
      );
      return false;
    });

    if (!asset) {
      logError(
        LogModule.GITHUB,
        `No adaptive asset found for version ID: ${versionId}`
      );
    }
    return asset;
  };

  /**
   * Format byte information
   * @param bytes Bytes
   * @param decimals Decimal places
   * @returns
   */
  const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024; // 1 KB = 1024 Bytes
    const dm = decimals < 0 ? 0 : decimals; // Ensure decimal places are not less than 0
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k)); // Calculate unit index
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]; // Return formatted string
  };

  /**
   * handle github api release json
   * @param githubReleaseJsonStr jsonStr
   * @returns versions
   */
  const handleApiResponse = (githubReleaseJsonStr: string) => {
    const downloadPath = path.join(app.getPath("userData"), "download");
    logInfo(LogModule.GITHUB, "Parsing GitHub release JSON response.");

    versions = JSON.parse(githubReleaseJsonStr);
    if (versions) {
      logInfo(
        LogModule.GITHUB,
        "Successfully parsed versions from GitHub response."
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
            logInfo(
              LogModule.GITHUB,
              `Asset found: ${asset.name}, download count: ${download_count}`
            );
          } else {
            logWarn(LogModule.GITHUB, `No asset found for version ID: ${m.id}`);
          }
          return m;
        });
      logDebug(
        LogModule.GITHUB,
        `Retrieved FRP versions: ${JSON.stringify(returnVersionsData)}`
      );
      return returnVersionsData;
    } else {
      logError(
        LogModule.GITHUB,
        "Failed to parse versions: No versions found in response."
      );
      return [];
    }
  };

  /**
   * conventMirrorUrl
   * @param mirror mirror
   * @returns mirrorUrl
   */
  const conventMirrorUrl = (mirror: string) => {
    switch (mirror) {
      case "github":
        return {
          api: "https://api.github.com",
          asset: "https://github.com"
        };
      default:
        return {
          api: "https://api.github.com",
          asset: "https://github.com"
        };
    }
  };

  /**
   * 获取github上的frp所有版本
   */
  ipcMain.on("github.getFrpVersions", async (event, mirror: string) => {
    const { api } = conventMirrorUrl(mirror);
    const mirrorUrl = api;
    logInfo(LogModule.GITHUB, `Requesting mirror URL: ${mirrorUrl}`);
    const request = net.request({
      method: "get",
      url: `${mirrorUrl}/repos/fatedier/frp/releases?page=1&per_page=1000`
    });

    let githubReleaseJsonStr = null;
    request.on("response", response => {
      logInfo(LogModule.GITHUB, `Received response with status code: ${response.statusCode}`);
      let responseData: Buffer = Buffer.alloc(0);
      response.on("data", (data: Buffer) => {
        responseData = Buffer.concat([responseData, data]);
      });
      response.on("end", () => {
        if (response.statusCode === 200) {
          githubReleaseJsonStr = responseData.toString();
          logInfo(
            LogModule.GITHUB,
            "Successfully retrieved GitHub release data."
          );
        } else {
          logWarn(
            LogModule.GITHUB,
            "Failed to retrieve data, using local JSON instead. Status code: " +
              response.statusCode
          );
          githubReleaseJsonStr = JSON.stringify(frpReleasesJson);
        }
        const versions = handleApiResponse(githubReleaseJsonStr);
        event.reply("Download.frpVersionHook", versions);
      });
    });

    request.on("error", error => {
      logError(
        LogModule.GITHUB,
        "Error occurred while requesting GitHub releases: " + error
      );
      githubReleaseJsonStr = JSON.stringify(frpReleasesJson);
      const versions = handleApiResponse(githubReleaseJsonStr);
      event.reply("Download.frpVersionHook", versions);
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

    let url = browser_download_url.replace(
      "https://github.com",
      conventMirrorUrl(mirror).asset
    );

    // if (mirror === "ghproxy") {
    //   url = "https://mirror.ghproxy.com/" + url;
    // }

    logDebug(
      LogModule.GITHUB,
      `Starting download for versionId: ${versionId}, mirror: ${mirror}, download URL: ${url}`
    );

    // 数据目录
    await download(BrowserWindow.getFocusedWindow(), url, {
      filename: `${asset.name}`,
      directory: path.join(app.getPath("userData"), "download"),
      onProgress: progress => {
        event.reply("Download.frpVersionDownloadOnProgress", {
          id: versionId,
          progress: progress
        });
        logDebug(
          LogModule.GITHUB,
          `Download progress for versionId: ${versionId} is ${
            progress.percent * 100
          }%`
        );
      },
      onCompleted: () => {
        log.info(`frp下载完成 url：${url} asset：${asset.name}`);
        logInfo(
          LogModule.GITHUB,
          `Download completed for versionId: ${versionId}, asset: ${asset.name}`
        );

        const targetPath = path.resolve(
          path.join(app.getPath("userData"), "frp")
        );
        const ext = path.extname(asset.name);
        let frpcVersionPath = "";

        try {
          if (ext === ".zip") {
            frpcVersionPath = unZip(
              path.join(
                path.join(app.getPath("userData"), "download"),
                `${asset.name}`
              ),
              targetPath
            );
            logInfo(
              LogModule.GITHUB,
              `Unzipped file to path: ${frpcVersionPath}`
            );
          } else if (ext === ".gz" && asset.name.includes(".tar.gz")) {
            frpcVersionPath = unTarGZ(
              path.join(
                path.join(app.getPath("userData"), "download"),
                `${asset.name}`
              ),
              targetPath
            );
            logInfo(
              LogModule.GITHUB,
              `Untarred file to path: ${frpcVersionPath}`
            );
          }
        } catch (error) {
          logError(
            LogModule.GITHUB,
            `Error during extraction: ${error.message}`
          );
        }

        version["frpcVersionPath"] = frpcVersionPath;
        insertVersion(version, (err, document) => {
          if (!err) {
            listVersion((err, doc) => {
              event.reply("Config.versions.hook", { err, data: doc });
              event.reply("Download.frpVersionDownloadOnCompleted", versionId);
              version.download_completed = true;
              logInfo(
                LogModule.GITHUB,
                `Version ${versionId} has been inserted successfully.`
              );
            });
          } else {
            logError(LogModule.GITHUB, `Error inserting version: ${err}`);
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
    logDebug(
      LogModule.GITHUB,
      `Attempting to delete version with ID: ${id} and path: ${absPath}`
    );
    if (fs.existsSync(absPath)) {
      deleteVersionById(id, () => {
        fs.unlinkSync(absPath);
        logInfo(
          LogModule.GITHUB,
          `Successfully deleted version with ID: ${id}`
        );
      });
    } else {
      logWarn(
        LogModule.GITHUB,
        `Version with ID: ${id} not found at path: ${absPath}`
      );
    }
    listVersion((err, doc) => {
      if (err) {
        logError(LogModule.GITHUB, `Error listing versions: ${err}`);
      } else {
        event.reply("Config.versions.hook", { err, data: doc });
        event.reply("Download.deleteVersion.hook", {
          err: null,
          data: "删除成功"
        });
      }
    });
  });

  /**
   * 获取最后版本
   */
  ipcMain.on("github.getFrpcDesktopLastVersions", async event => {
    logInfo(LogModule.GITHUB, "Requesting the latest version from GitHub.");
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
        try {
          versions = JSON.parse(responseData.toString());
          logInfo(
            LogModule.GITHUB,
            "Successfully retrieved the latest version."
          );
          event.reply("github.getFrpcDesktopLastVersionsHook", versions);
        } catch (error) {
          logError(
            LogModule.GITHUB,
            `Error parsing response data: ${error.message}`
          );
        }
      });
    });
    request.on("error", error => {
      logError(LogModule.GITHUB, `Request error: ${error.message}`);
    });
    request.end();
  });
};
