import log from "electron-log";

class Logger {
  static {
    log.transports.file.level = "info";
    log.transports.console.level = "info";
  }

  public static setLevel(level: string) {
      if (!level) {
          return
      }
      log.transports.file.level = level;
      log.transports.console.level = level;
  }

  public static info(module: string, msg: string) {
    log.info(`[${module}] ${msg}`);
  }

  public static debug(module: string, msg: string) {
    log.debug(`[${module}] ${msg}`);
  }

  public static warn(module: string, msg: string) {
    log.warn(`[${module}] ${msg}`);
  }

  public static error(module: string, error: Error) {
    log.error(`[${module}] ${error}`);
  }
}

export default Logger;