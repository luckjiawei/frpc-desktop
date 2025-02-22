import BaseController from "./BaseController";
import ServerService from "../service/ServerService";
import { success } from "../utils/response";

class ServerController extends BaseController {
  private readonly _serverService: ServerService;

  constructor(serverService: ServerService) {
    super();
    this._serverService = serverService;
  }

  saveConfig(req: ControllerParam) {
    this._serverService.saveServerConfig(req.args).then(() => {
      req.event.reply(req.channel, success());
    })
  }

  getServerConfig(req: ControllerParam) {
    console.log("get", req.args);
    this._serverService.getServerConfig().then(data => {
      req.event.reply(req.channel, success(data));
    });

  }
}

export default ServerController;
