import electron, {app, BrowserWindow, ipcMain, net, shell} from "electron";
import {deleteVersionById, insertVersion} from "../storage/version";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const {download} = require("electron-dl");
const unzipper = require('unzipper');
const AdmZip = require('adm-zip');
const log = require('electron-log');

const versionRelation = {
    "win32_x64": ["window", "amd64"],
    "win32_arm64": ["window", "arm64"],
    "win32_ia32": ["window", "386"],
    "darwin_arm64": ["darwin", "arm64"],
    "darwin_x64": ["darwin", "amd64"],
    // "darwin_arm64": ["window", "amd64"],
    "darwin_amd64": ["darwin", "amd64"],
}
const platform = process.platform;
const arch = process.arch;
let currArch = `${platform}_${arch}`
// currArch = `darwin_x64`
const frpArch = versionRelation[currArch]

const unTarGZ = (tarGzPath: string, targetPath: string) => {
    const tar = require("tar");
    const unzip = zlib.createGunzip();
    log.debug(`开始解压tar.gz：${tarGzPath} 目标目录：${targetPath}`);
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
    const frpcPath = path.join("frp", path.basename(tarGzPath, ".tar.gz"));
    log.debug(`解压完成 解压后目录：${frpcPath}`);
    return frpcPath;
    // .on("finish", () => {
    //   console.log("解压完成！");
    // });
};

const unZip = (zipPath: string, targetPath: string) => {
    if (!fs.existsSync(path.join(targetPath, path.basename(zipPath, ".zip")))) {
        fs.mkdirSync(path.join(targetPath, path.basename(zipPath, ".zip")), {recursive: true});
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

    const zip = new AdmZip(zipPath)
    zip.extractAllTo(targetPath, true); // 第二个参数为 true，表示覆盖已存在的文件
    const frpcPath = path.join("frp", path.basename(zipPath, ".zip"));
    log.debug(`解压完成 解压后目录：${frpcPath}`);
    return frpcPath
}

export const initGitHubApi = () => {
    // 版本
    let versions = [];

    const getVersion = versionId => {
        return versions.find(f => f.id === versionId);
    };

    const getAdaptiveAsset = versionId => {
        const {assets} = getVersion(versionId);
        const asset = assets.find(
            f => {
                // const a = versionRelation[currArch]
                const a = frpArch
                if (a) {
                    const flag = a.every(item => f.name.includes(item))
                    return flag;
                }
                return false;
            }
        );
        if (asset) {
            log.info(`找到对应版本 ${asset.name}`)
        }
        return asset;
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
                log.info(`开始获取frp版本 当前架构：${currArch} 对应frp架构：${frpArch}`)
                const returnVersionsData = versions
                    .filter(f => getAdaptiveAsset(f.id))
                    .map(m => {
                        const asset = getAdaptiveAsset(m.id);
                        if (asset) {
                            const absPath = `${downloadPath}/${asset.name}`;
                            m.absPath = absPath;
                            m.download_completed = fs.existsSync(absPath);
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
        const version = getVersion(args);
        const asset = getAdaptiveAsset(args);
        const {browser_download_url} = asset;
        log.info(`开始下载frp url：${browser_download_url} asset：${asset.name}`)
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
                log.info(`frp下载完成 url：${browser_download_url} asset：${asset.name}`)
                const targetPath = path.resolve(path.join(app.getPath("userData"), "frp"));
                const ext = path.extname(asset.name)
                let frpcVersionPath = ""
                if (ext === '.zip') {
                    frpcVersionPath = unZip(path.join(
                            path.join(app.getPath("userData"), "download"),
                            `${asset.name}`
                        ),
                        targetPath)
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

    /**
     * 删除下载
     */
    ipcMain.on("github.deleteVersion", async (event, args) => {
        const {absPath, id} = args;
        if (fs.existsSync(absPath)) {
            deleteVersionById(id, () => {
                fs.unlinkSync(absPath)
            })
        }
        event.reply("Download.deleteVersion.hook", {
            err: null,
            data: "删除成功"
        });
    })

    /**
     * 打开GitHub
     */
    ipcMain.on("github.open", () => {
        shell.openExternal("https://github.com/luckjiawei/frpc-desktop");
    })

    electron.ipcMain.on("github.openReleases", () => {
        electron.shell.openExternal("https://github.com/luckjiawei/frpc-desktop/releases");
    });
};
