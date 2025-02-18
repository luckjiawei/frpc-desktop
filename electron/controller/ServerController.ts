import BaseController from "./BaseController";
import ServerService from "../service/ServerService";
import IpcMainEvent = Electron.IpcMainEvent;

class ServerController extends BaseController {
  serverService: ServerService;

  constructor(serverService: ServerService) {
    super();
    this.serverService = serverService;
  }

  saveConfig(event: IpcMainEvent, ...args: any[]) {
    console.log("test", args);
  }
}

export default ServerController;
