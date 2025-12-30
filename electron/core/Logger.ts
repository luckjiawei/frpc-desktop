import log, { LevelOption } from "electron-log";

export default class Logger {
  static {
    log.initialize();
    log.transports.file.level = "info";
    log.transports.console.level = "info";
    log.transports.file.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
    log.transports.console.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
  }

  public static setLevel(level: string) {
    if (!level) {
      return;
    }
    log.transports.file.level = level as LevelOption;
    log.transports.console.level = level as LevelOption;
  }

  // public static info(module: string, msg: string) {
  //   log.info(`[${module}] ${msg}`);
  // }

  // public static debug(module: string, msg: string) {
  //   log.debug(`[${module}] ${msg}`);
  // }

  // public static warn(module: string, msg: string) {
  //   log.warn(`[${module}] ${msg}`);
  // }

  // public static error(module: string, error: Error) {
  //   log.error(`[${module}] ${error}`);
  // }
}
