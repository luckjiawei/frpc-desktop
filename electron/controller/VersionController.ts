import BaseController from "./BaseController";
import VersionService from "../service/VersionService";
import ResponseUtils from "../utils/ResponseUtils";
import VersionRepository from "../repository/VersionRepository";
import Logger from "../core/Logger";

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
      .catch(err => {
        Logger.error("VersionController.getVersions", err);
        this._versionService.getFrpVersionByLocalJson().then(localData => {
          req.event.reply(req.channel, ResponseUtils.success(localData));
        });
      });
  }

  getDownloadedVersions(req: ControllerParam) {
    this._versionDao
      .findAll()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        Logger.error("VersionController.getDownloadedVersions", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
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
        req.event.reply(
          req.channel,
          ResponseUtils.success({
            percent: 1,
            githubReleaseId: req.args.githubReleaseId,
            completed: true
          })
        );
      })
      .catch((err: Error) => {
        Logger.error("VersionController.downloadFrpVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }

  deleteDownloadedVersion(req: ControllerParam) {
    this._versionService
      .deleteFrpVersion(req.args.githubReleaseId)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("VersionController.deleteDownloadedVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }

  importLocalFrpcVersion(req: ControllerParam) {
    this._versionService
      .importLocalFrpcVersion()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        Logger.error("VersionController.importLocalFrpcVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err.message));
      });
  }
}

export default VersionController;
