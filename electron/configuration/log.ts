import { app } from "electron";
import log from "electron-log/main";
export default class LogConfiguration {
  constructor() {
    log.initialize();
    log.transports.file.level = "info";
    log.transports.console.level = "info";
    log.transports.file.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}";
    log.transports.console.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}";

    log.scope("main").info("FrpcDesktopApp Version " + app.getVersion());
    log.scope("main").info("Process argv: " + process.argv.join(" "));
    log.scope("main").info("Process cwd: " + process.cwd());
    log.scope("main").info("Process execPath: " + process.execPath);
    log.scope("main").info("Process platform: " + process.platform);
    log.scope("main").info("Process arch: " + process.arch);
    log.scope("main").info("Process node version: " + process.versions.node);
    log
      .scope("main")
      .info("Process electron version: " + process.versions.electron);

    log.scope("main").info("Log initialized");
  }
}
