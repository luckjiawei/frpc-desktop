import log from "electron-log";

class Logger {
  static {
    log.transports.file.level = "debug";
    log.transports.console.level = "debug";
  }

  static info(msg: string) {}

  static debug(msg: string) {}

  static warn(msg: string) {}

  static error(msg: string) {}
}

export default Logger;