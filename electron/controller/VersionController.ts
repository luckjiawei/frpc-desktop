import "reflect-metadata";

import BaseController from "../core/BaseController";
import VersionService from "../service/VersionService";
import ResponseUtils from "../utils/ResponseUtils";
import VersionRepository from "../repository/VersionRepository";
import { BrowserWindow, dialog } from "electron";
import BeanFactory from "../core/BeanFactory";
import log from "electron-log/main";
import { injectable, inject } from "inversify";
import { TYPES } from "../main";

@injectable()
export default class VersionController extends BaseController {
  private readonly _versionService: VersionService;
  private readonly _versionDao: VersionRepository;

  constructor(
    @inject(TYPES.VersionService) versionService: VersionService,
    @inject(TYPES.VersionRepository) versionDao: VersionRepository
  ) {
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
        log.error("VersionController.getVersions", err);
        this._versionService.getFrpVersionByLocalJson().then(localData => {
          req.event.reply(req.channel, ResponseUtils.success(localData));
        });
      });
  }

  getDownloadedVersions(req: ControllerParam) {
    this._versionDao
      .selectAll()
      .then(data => {
        req.event.reply(req.channel, ResponseUtils.success(data));
      })
      .catch((err: Error) => {
        log.error("VersionController.getDownloadedVersions", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
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
        log.error("VersionController.downloadFrpVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  deleteDownloadedVersion(req: ControllerParam) {
    this._versionService
      .deleteFrpVersion(req.args.githubReleaseId)
      .then(() => {
        req.event.reply(req.channel, ResponseUtils.success());
      })
      .catch((err: Error) => {
        log.error("VersionController.deleteDownloadedVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });
  }

  importLocalFrpcVersion(req: ControllerParam) {
    const win: BrowserWindow = BeanFactory.getBean("win");
    dialog
      .showOpenDialog(win, {
        properties: ["openFile"],
        filters: [
          { name: "Frpc", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
        ]
      })
      .then(result => {
        if (result.canceled) {
          req.event.reply(
            req.channel,
            ResponseUtils.success({
              canceled: true
            })
          );
          return;
        } else {
          const filePath = result.filePaths[0];
          this._versionService
            .importLocalFrpcVersion(filePath)
            .then(data => {
              req.event.reply(
                req.channel,
                ResponseUtils.success({
                  canceled: false
                })
              );
            })
            .catch((err: Error) => {
              log.error("VersionController.importLocalFrpcVersion", err);
              req.event.reply(req.channel, ResponseUtils.fail(err));
            });
        }
      })
      .catch(err => {
        log.error("VersionController.importLocalFrpcVersion", err);
        req.event.reply(req.channel, ResponseUtils.fail(err));
      });

    // const win: BrowserWindow = BeanFactory.getBean("win");
    // const result = await dialog.showOpenDialog(win, {
    //   properties: ["openFile"],
    //   filters: [
    //     { name: "Frpc", extensions: ["tar.gz", "zip"] } // 允许选择的文件类型，分开后缀以确保可以选择
    //   ]
    // });
    // if (result.canceled) {
    //
    // }else {
    //
    // }
  }
}
