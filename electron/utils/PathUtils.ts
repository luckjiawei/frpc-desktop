import SecureUtils from "./SecureUtils";

import { app } from "electron";
import path from "path";
import FileUtils from "./FileUtils";

class PathUtils {
  public static getDownloadStoragePath() {
    const result = path.join(PathUtils.getAppData(), "download");
    FileUtils.mkdir(result);
    return result;
  }

  public static getVersionStoragePath() {
    const result = path.join(
      PathUtils.getAppData(),
      SecureUtils.calculateMD5("frpc")
    );
    FileUtils.mkdir(result);
    return result;
  }

  public static getConfigStoragePath() {
    const result = path.join(
      PathUtils.getAppData(),
      // SecureUtils.calculateMD5("config")
      "config"
    );
    FileUtils.mkdir(result);
    return result;
  }

  public static getFrpcFilename() {
    return SecureUtils.calculateMD5("frpc");
  }

  public static getAppData() {
    return app.getPath("userData");
  }

  public static getTomlConfigFilePath() {
    return path.join(
      PathUtils.getConfigStoragePath(),
      SecureUtils.calculateMD5("frpc") + ".toml"
    );
  }

  public static getFrpcLogStoragePath() {
    const result = path.join(PathUtils.getAppData(), "log");
    FileUtils.mkdir(result);
    return result;
  }

  public static getFrpcLogFilePath() {
    return path.join(
      PathUtils.getFrpcLogStoragePath(),
      SecureUtils.calculateMD5("frpc-log") + ".log"
    );
  }
}

export default PathUtils;
