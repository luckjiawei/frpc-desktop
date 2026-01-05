export class GlobalConstant {
  public static ZIP_EXT = ".zip";
  public static TOML_EXT = ".toml";
  public static GZ_EXT = ".gz";
  public static TAR_GZ_EXT = ".tar.gz";
  public static LOCAL_IP = "127.0.0.1";
  public static FRPC_LOGIN_FAIL_EXIT = false;
  public static INTERNET_CHECK_URL = "https://jwinks.com";
  public static INTERNET_CHECK_TIMEOUT = 10;
  public static DEFAULT_LANGUAGE = "en-US";
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


/**
 * response code
 */
export const ResponseCode = {
  SUCCESS: { code: "A1000", message: "successful." },
  INTERNAL_ERROR: { code: "B1000", message: "internal error." },
  NOT_CONFIG: { code: "B1001", message: "Not configured." },
  VERSION_EXISTS: { code: "B1002", message: "Import failed, version already exists" },
  VERSION_ARGS_ERROR: { code: "B1003", message: "The selected frp architecture does not match the operating system" },
  UNKNOWN_VERSION: { code: "B1004", message: "Unrecognized file" },
  NOT_FOUND_VERSION: { code: "B1005", message: "Version not found" },
  WEB_SERVER_PORT_IN_USE: { code: "B1006", message: "WebServer Port In Use" },
  GITHUB_UNAUTHORIZED: { code: "B1007", message: "Unauthorized on GitHub" },
  GITHUB_NETWORK_ERROR: { code: "B1008", message: "GitHub network error" },
};

/**
 * 
 */
export const IPCChannels = {
  /*
  * launch
   */
  LAUNCH: "launch/launch",
  TERMINATE: "launch/terminate",
  GET_STATUS: "launch/getStatus",

  /**
   * log
   */
  LOG_GET_FRP_LOG_CONTENT: "log/getFrpLogContent",
  LOG_GET_APP_LOG_CONTENT: "log/getAppLogContent",
  LOG_OPEN_FRPC_LOG_FILE: "log/openFrpcLogFile",
  LOG_OPEN_APP_LOG_FILE: "log/openAppLogFile",

  /**
   * config
   */
  CONFIG_SAVE_CONFIG: "config/saveConfig",
  CONFIG_GET_SERVER_CONFIG: "config/getServerConfig",
  CONFIG_OPEN_APP_DATA: "config/openAppData",
  CONFIG_RESET_ALL_CONFIG: "config/resetAllConfig",
  CONFIG_EXPORT_CONFIG: "config/exportConfig",
  CONFIG_IMPORT_TOML_CONFIG: "config/importTomlConfig",
  CONFIG_GET_LANGUAGE: "config/getLanguage",
  CONFIG_SAVE_LANGUAGE: "config/saveLanguage",

  /**
   * proxy
   */
  PROXY_CREATE_PROXY: "proxy/createProxy",
  PROXY_MODIFY_PROXY: "proxy/modifyProxy",
  PROXY_GET_ALL_PROXIES: "proxy/getAllProxies",
  PROXY_DELETE_PROXY: "proxy/deleteProxy",
  PROXY_MODIFY_PROXY_STATUS: "proxy/modifyProxyStatus",
  PROXY_GET_LOCAL_PORTS: "proxy/getLocalPorts",

  /**
   * system
   */
  SYSTEM_OPEN_URL: "system/openUrl",
  SYSTEM_RELAUNCH_APP: "system/relaunchApp",
  SYSTEM_OPEN_APP_DATA: "system/openAppData",
  SYSTEM_SELECT_LOCAL_FILE: "system/selectLocalFile",
  SYSTEM_GET_FRPC_DESKTOP_GITHUB_LAST_RELEASE: "system/getFrpcDesktopGithubLastRelease",

  /**
   * version
   */
  VERSION_GET_VERSIONS: "version/getVersions",
  VERSION_GET_DOWNLOADED_VERSIONS: "version/getDownloadedVersions",
  VERSION_DOWNLOAD_FRP_VERSION: "version/downloadFrpVersion",
  VERSION_DELETE_DOWNLOADED_VERSION: "version/deleteDownloadedVersion",
  VERSION_IMPORT_LOCAL_FRPC_VERSION: "version/importLocalFrpcVersion",
}

/**
 * event channels
 */
export const EventChannels = {
  FRPC_PROCESS_STATUS: "frpc-process/status",
  SYSTEM_MONITOR: "monitor/system-monitor",
  VERSIONS_GET_VERSIONS: "versions/get-versions",
}