import BaseController from "./BaseController";
import VersionService from "../service/VersionService";
import { fail, success } from "../utils/response";
import VersionDao from "../dao/VersionDao";

class VersionController extends BaseController {
  private readonly _versionService: VersionService;
  private readonly _versionDao: VersionDao;

  constructor(versionService: VersionService, versionDao: VersionDao) {
    super();
    this._versionService = versionService;
    this._versionDao = versionDao;
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

  getDownloadedVersions(req: ControllerParam) {
    this._versionDao.findAll().then(data => {
      req.event.reply(req.channel, success(data));
    });
  }

  downloadFrpVersion(req: ControllerParam) {
    this._versionService
      .downloadFrpVersion(req.args.githubReleaseId, progress => {
        req.event.reply(
          req.channel,
          success({
            percent: progress.percent,
            githubReleaseId: req.args.githubReleaseId,
            completed: progress.percent >= 1
          })
        );
      })
      .then(r => {
        console.log(2);
      })
      .catch(err => {
        console.log(1);
      });
  }

  deleteDownloadedVersion(req: ControllerParam) {
    this._versionService
      .deleteFrpVersion(req.args.githubReleaseId)
      .then(() => {
        req.event.reply(req.channel, success());
      })
      .catch(err => {
        req.event.reply(req.channel, fail());
      });
  }

  importLocalFrpcVersion (){

  }
}

export default VersionController;
