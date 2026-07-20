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

  public static getWinFrpFilename() {
    return SecureUtils.calculateMD5("frpc") + ".exe";
  }

  public static getAppData() {
    return app.getPath("userData");
  }

  public static getDataBaseStoragePath() {
    const result = path.join(PathUtils.getAppData(), "db");
    FileUtils.mkdir(result);
    return result;
  }

  public static getTomlConfigFilePath() {
    return path.join(
      PathUtils.getConfigStoragePath(),
      SecureUtils.calculateMD5("frpc") + ".toml"
    );
  }

  public static getTomlConfigFilePathByServerId(serverId = "1") {
    if (!serverId || serverId === "1") {
      return PathUtils.getTomlConfigFilePath();
    }
    return path.join(
      PathUtils.getConfigStoragePath(),
      `frpc-${serverId.replace(/[^a-zA-Z0-9_-]/g, "_")}.toml`
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

  public static getFrpcLogFilePathByServerId(serverId = "1") {
    if (!serverId || serverId === "1") {
      return PathUtils.getFrpcLogFilePath();
    }
    return path.join(
      PathUtils.getFrpcLogStoragePath(),
      `frpc-${serverId.replace(/[^a-zA-Z0-9_-]/g, "_")}.log`
    );
  }

  public static getAppLogFilePath() {
    return path.join(app.getPath("logs"), "main.log");
  }
}

export default PathUtils;
