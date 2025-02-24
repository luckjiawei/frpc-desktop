import { app, dialog, shell } from "electron";
import GlobalConstant from "../core/GlobalConstant";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import admZip from "adm-zip";

const tar = require("tar");

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
          reject(true);
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
    const zip = new admZip(zipFilePath);
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

  openFile(name: string, ext: any) {
    return dialog.showOpenDialogSync({
      properties: ["openFile"],
      filters: [
        {
          name: name,
          extensions: ext
        }
      ]
    });
  }

  async openDirectory() {
    return await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });
  }
}

export default SystemService;
