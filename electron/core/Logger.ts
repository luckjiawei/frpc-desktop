import log from "electron-log";

class Logger {
  static {
    log.transports.file.level = "debug";
    log.transports.console.level = "debug";
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