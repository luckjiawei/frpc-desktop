
class GlobalConstant {
  public static ZIP_EXT = ".zip";
  public static TOML_EXT = ".toml";
  public static GZ_EXT = ".gz";
  public static TAR_GZ_EXT = ".tar.gz";
  public static LOCAL_IP = "127.0.0.1";
  public static FRPC_LOGIN_FAIL_EXIT = false;
  public static INTERNET_CHECK_URL = "https://jwinks.com";
  public static INTERNET_CHECK_TIMEOUT = 10;

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

  public static FRPC_PROCESS_STATUS_CHECK_INTERVAL = 1;
}

export default GlobalConstant;
