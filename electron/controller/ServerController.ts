import BaseController from "./BaseController";
import ServerService from "../service/ServerService";
import { success } from "../utils/response";
import FileService from "../service/FileService";
import PathUtils from "../utils/PathUtils";

class ServerController extends BaseController {
  private readonly _serverService: ServerService;
  private readonly _fileService: FileService;

  constructor(serverService: ServerService, fileService: FileService) {
    super();
    this._serverService = serverService;
    this._fileService = fileService;
  }

  saveConfig(req: ControllerParam) {
    this._serverService.saveServerConfig(req.args).then(() => {
      req.event.reply(req.channel, success());
    });
  }

  getServerConfig(req: ControllerParam) {
    console.log("get", req.args);
    this._serverService.getServerConfig().then(data => {
      req.event.reply(req.channel, success(data));
    });
  }

  openAppData(req: ControllerParam) {
    this._fileService.openLocalPath(PathUtils.getAppData()).then(data => {
      req.event.reply(req.channel, success(data));
    });
  }
}

export default ServerController;
