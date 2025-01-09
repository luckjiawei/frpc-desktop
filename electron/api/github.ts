import electron, {
  app,
  dialog,
  BrowserWindow,
  ipcMain,
  net,
  shell
} from "electron";
import {
  deleteVersionById,
  getVersionById,
  insertVersion,
  listVersion
} from "../storage/version";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { download } = require("electron-dl");
const AdmZip = require("adm-zip");
import frpReleasesJson from "../json/frp-releases.json";
import frpChecksums from "../json/frp_all_sha256_checksums.json";
import { logInfo, logError, LogModule, logDebug, logWarn } from "../utils/log";
import { calculateFileChecksum, formatBytes } from "../utils/file";
import { el } from "element-plus/es/locale";

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
    fs.mkdirSync(targetPath, { recursive: true, mode: 0o777 });
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

export const initGitHubApi = win => {
  // 版本
  let versions: FrpVersion[] = [];

  const getVersionByGithubVersionId = versionId => {
    logDebug(LogModule.APP, `Attempting to get version with ID: ${versionId}`);
    const version = versions.find(f => f.id === versionId);
    if (version) {
      logInfo(
        LogModule.APP,
        `Version details ID:${version.id}, Name:${version.name}, Published At:${version.published_at}`
      );
    } else {
      logWarn(LogModule.APP, `No version found for ID: ${versionId}`);
    }
    return version;
  };

  const getVersionByAssetName = (assetName: string) => {
    logDebug(
      LogModule.APP,
      `Attempting to get version with asset name: ${assetName}`
    );
    const version = versions.find(f =>
      f.assets.some(asset => asset.name === assetName)
    );
    if (version) {
      logInfo(
        LogModule.APP,
        `Version details ID:${version.id}, Name:${version.name}, Published At:${version.published_at}`
      );
    } else {
      logWarn(LogModule.APP, `No version found for asset name: ${assetName}`);
    }
    return version;
  };

  const getAdaptiveAsset = versionId => {
    const { assets } = getVersionByGithubVersionId(versionId);
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
   * handle github api release json
   * @param githubReleaseJsonStr jsonStr
   * @returns versions
   */
  const handleApiResponse = (githubReleaseJsonStr: string) => {
    const downloadPath = path.join(app.getPath("userData"), "download");
    const frpPath = path.join(app.getPath("userData"), "frp");
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
            const absPath = path.join(
              frpPath,
              asset.name.replace(/(\.tar\.gz|\.zip)$/, "")
            );
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
      logInfo(
        LogModule.GITHUB,
        `Received response with status code: ${response.statusCode}`
      );
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

  const decompressFrp = (frpFilename: string, compressedFilePath: string) => {
    const targetPath = path.resolve(path.join(app.getPath("userData"), "frp"));
    const ext = path.extname(frpFilename);
    let frpcVersionPath = "";
    try {
      if (ext === ".zip") {
        unZip(
          // path.join(
          //   path.join(app.getPath("userData"), "download"),
          //   `${frpFilename}`
          // ),
          compressedFilePath,
          targetPath
        );
        logInfo(LogModule.APP, `Unzipped file to path: ${frpcVersionPath}`);
        frpcVersionPath = path.join("frp", path.basename(frpFilename, ".zip"));
      } else if (ext === ".gz" && frpFilename.includes(".tar.gz")) {
        unTarGZ(
          // path.join(
          //   path.join(app.getPath("userData"), "download"),
          //   `${frpFilename}`
          // ),
          compressedFilePath,
          targetPath
        );
        frpcVersionPath = path.join(
          "frp",
          path.basename(frpFilename, ".tar.gz")
        );
        logInfo(LogModule.APP, `Untarred file to path: ${frpcVersionPath}`);
      }
    } catch (error) {
      logError(LogModule.APP, `Error during extraction: ${error.message}`);
    }

    return frpcVersionPath;
  };

  /**
   * 下载请求
   */
  ipcMain.on("github.download", async (event, args) => {
    const { versionId, mirror } = args;
    const version = getVersionByGithubVersionId(versionId);
    const asset = getAdaptiveAsset(versionId);
    const { browser_download_url } = asset;

    let url = browser_download_url.replace(
      "https://github.com",
      conventMirrorUrl(mirror).asset
    );

    logDebug(
      LogModule.GITHUB,
      `Starting download for versionId: ${versionId}, mirror: ${mirror}, download URL: ${url}`
    );

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
        logInfo(
          LogModule.GITHUB,
          `Download completed for versionId: ${versionId}, asset: ${asset.name}`
        );

        const frpcVersionPath = decompressFrp(
          asset.name,
          path.join(
            path.join(app.getPath("userData"), "download"),
            `${asset.name}`
          )
        );
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
      // if (process.platform === 'darwin') {
      //   fs.unlinkSync(absPath.replace(/ /g, '\\ '));
      // }else{
      //   fs.unlinkSync(absPath);
      // }
      fs.rmSync(absPath, { recursive: true, force: true });
      deleteVersionById(id, () => {
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

  ipcMain.on(
    "download.importFrpFile",
    async (event, filePath: string, targetPath: string) => {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: [
          { name: "Frp 文件", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
        ]
      });
      if (result.canceled) {
        logWarn(LogModule.APP, "Import canceled by user.");
        logWarn(LogModule.GITHUB, "User canceled the file import operation.");
        return;
      } else {
        const filePath = result.filePaths[0];
        // const fileExtension = path.extname(filePath);
        logInfo(LogModule.APP, `User selected file: ${filePath}`);
        const checksum = calculateFileChecksum(filePath);
        logInfo(LogModule.APP, `Calculated checksum for the file: ${checksum}`);
        const frpName = frpChecksums[checksum];
        if (frpName) {
          logInfo(LogModule.APP, `FRP file name found: ${frpName}`);
          if (frpArch.every(item => frpName.includes(item))) {
            logInfo(
              LogModule.APP,
              `Architecture matches for FRP file: ${frpName}`
            );
            const version = getVersionByAssetName(frpName);
            getVersionById(version.id, (err, existingVersion) => {
              if (!err && existingVersion) {
                logInfo(
                  LogModule.APP,
                  `Version already exists: ${JSON.stringify(existingVersion)}`
                );
                event.reply("Download.importFrpFile.hook", {
                  success: false,
                  data: `导入失败，版本已存在`
                });
                return; // 终止后续执行
              }

              const frpcVersionPath = decompressFrp(frpName, filePath);
              logInfo(
                LogModule.APP,
                `Successfully decompressed FRP file: ${frpName} to path: ${frpcVersionPath}`
              );
              version["frpcVersionPath"] = frpcVersionPath;
              insertVersion(version, (err, document) => {
                if (!err) {
                  listVersion((err, doc) => {
                    event.reply("Config.versions.hook", { err, data: doc });
                    version.download_completed = true;
                    event.reply("Download.importFrpFile.hook", {
                      success: true,
                      data: `导入成功`
                    });
                  });
                } else {
                  logError(LogModule.APP, `Error inserting version: ${err}`);
                  event.reply("Download.importFrpFile.hook", {
                    success: true,
                    data: `导入失败，未知错误`
                  });
                }
              });
            });
          } else {
            logWarn(
              LogModule.APP,
              `Architecture does not match for FRP file: ${frpName}`
            );
            event.reply("Download.importFrpFile.hook", {
              success: false,
              data: `导入失败，所选 frp 架构与操作系统不符`
            });
          }
        } else {
          logWarn(
            LogModule.APP,
            `No matching FRP file name found for checksum: ${checksum}`
          );
          event.reply("Download.importFrpFile.hook", {
            success: false,
            data: `导入失败，无法识别文件`
          });
        }
      }
    }
  );
};
