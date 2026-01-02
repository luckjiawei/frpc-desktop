import "reflect-metadata";
import { injectable, inject } from "inversify";
import BaseController from "electron/core/BaseController";
import { IpcRoute } from "electron/core/decorators";
import log from "electron-log/main";

@injectable()
export default class TestController extends BaseController {
  @IpcRoute("test/test1")
  async test1(event: any) {
    log.info("test controller");
  }
}
