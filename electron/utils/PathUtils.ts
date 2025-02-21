import SecureUtils from "./SecureUtils";

import { app } from "electron";
import path from "path";

class PathUtils {
  public static getDownloadStoragePath() {
    return path.join(
      PathUtils.getAppData(),
      SecureUtils.calculateMD5("download")
    );
  }

  public static getVersionStoragePath() {
    return path.join(
      PathUtils.getAppData(),
      SecureUtils.calculateMD5("frpc")
    );
  }

  public static getAppData() {
    return app.getPath("userData");
  }
}

export default PathUtils;
