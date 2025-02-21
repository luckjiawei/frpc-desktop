import path from "path";
import { app } from "electron";
import SecureUtils from "../utils/SecureUtils";

class GlobalConstant {
  public static FRPC_STORAGE_FOLDER = "";

  public static ZIP_EXT = ".zip";
  public static GZ_EXT = ".gz";
  public static TAR_GZ_EXT = ".tar.gz";
  // public static APP_DATA_PATH = app.getPath("userData");

  // public static DOWNLOAD_STORAGE_PATH = path.join(
  //   GlobalConstant.APP_DATA_PATH,
  //   SecureUtils.calculateMD5("download")
  // );
  //
  // public static VERSION_STORAGE_PATH = path.join(
  //   GlobalConstant.APP_DATA_PATH,
  //   SecureUtils.calculateMD5("frpc")
  // );
}

export default GlobalConstant;
