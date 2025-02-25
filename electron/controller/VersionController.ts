import BaseController from "./BaseController";
import VersionService from "../service/VersionService";
import ResponseUtils from "../utils/ResponseUtils";
import VersionRepository from "../repository/VersionRepository";

class VersionController extends BaseController {
  private readonly _versionService: VersionService;
  private readonly _versionDao: VersionRepository;

  constructor(versionService: VersionService, versionDao: VersionRepository) {
    super();
    this._versionService = versionService;
    this._versionDao = versionDao;
  }

  getVersions(req: ControllerParam) {
    this._versionService
      .getFrpVersionsByGitHub()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch(() => {
        this._versionService.getFrpVersionByLocalJson().then(localData => {
          req.event.reply(req.channel, ResponseUtils.success(localData));
        });
      });
  }

  getDownloadedVersions(req: ControllerParam) {
    this._versionDao.findAll().then(data => {
      req.event.reply(req.channel, ResponseUtils.success(data));
    });
  }

  downloadFrpVersion(req: ControllerParam) {
    this._versionService
      .downloadFrpVersion(req.args.githubReleaseId, progress => {
        req.event.reply(
          req.channel,
          ResponseUtils.success({
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
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch(err => {
        req.event.reply(req.channel, ResponseUtils.fail());
      });
  }

  importLocalFrpcVersion(req: ControllerParam) {
    // this._versionService
    //   .importLocalFrpcVersion(req.win)
    //   .then(data => {
    //     req.event.reply(req.channel, ResponseUtils.success());
    //   })
    //   .catch(err => {
    //     req.event.reply(req.channel, ResponseUtils.fail());
    //   });
  }
}

export default VersionController;
