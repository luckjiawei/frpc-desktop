import log from "electron-log";
// 定义模块枚举
export enum LogModule {
  APP = "app",
  FRP_CLIENT = "frpc client",
  LOGGER = "logger",
  GITHUB = "github",
  STORAGE = ""
}

export const initLog = () => {
  log.transports.file.level = "debug";
  log.transports.console.level = "debug";
};

// 自定义日志输出函数，记录到指定业务模块
export const logInfo = (module: LogModule, message: string) => {
  log.info(`[${module}] ${message}`);
};

export const logError = (module: LogModule, message: string) => {
  log.error(`[${module}] ${message}`);
};

export const logDebug = (module: LogModule, message: string) => {
  log.debug(`[${module}] ${message}`);
};

export const logWarn = (module: LogModule, message: string) => {
  log.warn(`[${module}] ${message}`);
};
