
class GlobalConstant {
  public static APP_NAME = "Frpc Desktop";
  public static ZIP_EXT = ".zip";
  public static GZ_EXT = ".gz";
  public static TAR_GZ_EXT = ".tar.gz";

  public static FRP_ARCH_VERSION_MAPPING = {
    win32_x64: ["window", "amd64"],
    win32_arm64: ["window", "arm64"],
    win32_ia32: ["window", "386"],
    darwin_arm64: ["darwin", "arm64"],
    darwin_x64: ["darwin", "amd64"],
    darwin_amd64: ["darwin", "amd64"],
    linux_x64: ["linux", "amd64"],
    linux_arm64: ["linux", "arm64"]
  };

  public static FRPC_PROCESS_STATUS_CHECK_INTERVAL = 3000;
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
