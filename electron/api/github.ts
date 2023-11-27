import {app, BrowserWindow, ipcMain, net} from "electron";
import {insertVersion} from "../storage/version";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {download} = require("electron-dl");
const unzipper = require('unzipper');


const versionRelation = {
    "win32_x64": ["window", "amd64"],
    "win32_arm64": ["window", "arm64"],
    "win32_ia32": ["window", "386"],
    "darwin_arm64": ["darwin", "arm64"],
    // "darwin_arm64": ["window", "amd64"],
    "darwin_amd64": ["darwin", "amd64"],
}

const unTarGZ = (tarGzPath: string, targetPath: string) => {
    const tar = require("tar");
    const unzip = zlib.createGunzip();
    const readStream = fs.createReadStream(tarGzPath);
    if (!fs.existsSync(unzip)) {
        fs.mkdirSync(targetPath, {recursive: true});
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

const unZip = (zipPath: string, targetPath: string) => {
    if (!fs.existsSync(path.join(targetPath, path.basename(zipPath, ".zip")))) {
        fs.mkdirSync(path.join(targetPath, path.basename(zipPath, ".zip")), {recursive: true});
    }
    fs.createReadStream(zipPath)
        .pipe(unzipper.ParseOne('frpc'))
        .pipe(fs.createWriteStream(path.join(targetPath, path.basename(zipPath, ".zip"), "frpc.exe")))
        .on('finish', () => {
            console.log('File extracted successfully.');
        })
        .on('error', (err) => {
            console.error('Error extracting file:', err);
        });
    return path.join("frp", path.basename(zipPath, ".zip"))
}

export const initGitHubApi = () => {
    // 版本
    let versions = [];

    const getVersion = versionId => {
        return versions.find(f => f.id === versionId);
    };

    const getAdaptiveAsset = versionId => {
        const {assets} = getVersion(versionId);
        const arch = process.arch;
        const platform = process.platform;
        const asset = assets.find(
            f => {
                const a = versionRelation[`${platform}_${arch}`]
                if (a) {
                    const flag = a.every(item => f.name.includes(item))
                    return flag;
                }
                return false;
            }
        );
        if (asset) {
            console.log(asset.name)
        }
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
                            const absPath = `${downloadPath}/${asset.name}`;
                            m.download_completed = fs.existsSync(absPath);
                        }
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
        const {browser_download_url} = asset;
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
                const targetPath = path.resolve(path.join(app.getPath("userData"), "frp"));
                const ext = path.extname(asset.name)
                let frpcVersionPath = ""
                if (ext === '.zip') {
                    frpcVersionPath = unZip(path.join(
                            path.join(app.getPath("userData"), "download"),
                            `${asset.name}`
                        ),
                        targetPath)
                    console.log(frpcVersionPath, '1')
                } else if (ext === '.gz' && asset.name.includes(".tar.gz")) {
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
                        event.reply("Download.frpVersionDownloadOnCompleted", args);
                        version.download_completed = true;
                    }
                });
            }
        });
    });
};
