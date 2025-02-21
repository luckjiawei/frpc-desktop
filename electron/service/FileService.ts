import { shell } from "electron";
import path from "path";
import fs from "fs";
import zlib from "zlib";
import admZip from "adm-zip";
import GlobalConstant from "../core/GlobalConstant";
import { logError, logInfo, LogModule } from "../utils/log";
// import tar from "tar";

class FileService {
  constructor() {}

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

  decompressTarGzFile(tarGzPath: string, targetPath: string) {
    // const targetFolder = path.join(targetPath, targetPath);
    const unzip = zlib.createGunzip();
    const readStream = fs.createReadStream(tarGzPath);
    // if (!fs.existsSync(unzip)) {
    //   fs.mkdirSync(targetPath, { recursive: true, mode: 0o777 });
    // }
    readStream
      .pipe(unzip)
      .on("error", err => {
        logError(LogModule.APP, `Error during gunzip: ${err.message}`);
      })
      // .pipe(
      //   tar
      //     .extract({
      //       cwd: targetPath,
      //       filter: filePath => path.basename(filePath) === "frpc"
      //     })
      //     .on("error", err => {
      //       logError(
      //         LogModule.APP,
      //         `Error extracting tar file: ${err.message}`
      //       );
      //     })
      // )
      .on("finish", () => {
        const frpcPath = path.join("frp", path.basename(tarGzPath, ".tar.gz"));
        logInfo(
          LogModule.APP,
          `Extraction completed. Extracted directory: ${frpcPath}`
        );
      });
  }
}

export default FileService;
