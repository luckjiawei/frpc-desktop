import BaseController from "./BaseController";
import VersionService from "../service/VersionService";
import { success } from "../utils/response";

class VersionController extends BaseController {
  private readonly _versionService: VersionService;

  constructor(versionService: VersionService) {
    super();
    this._versionService = versionService;
  }

  getVersions(req: ControllerParam) {
    this._versionService
      .getFrpVersionsByGitHub()
      .then(data => {
        req.event.reply(req.channel, success(data));
      })
      .catch(() => {
        this._versionService.getFrpVersionByLocalJson().then(localData => {
          req.event.reply(req.channel, success(localData));
        });
      });
  }
}

export default VersionController;
