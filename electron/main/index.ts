import "reflect-metadata";

import { Container } from "inversify";
import { FrpcDesktopApp } from "./app";
import ConfigController from "../controller/ConfigController";
import LaunchController from "../controller/LaunchController";
import LogController from "../controller/LogController";
import ProxyController from "../controller/ProxyController";
import SystemController from "../controller/SystemController";
import VersionController from "../controller/VersionController";
import OpenSourceConfigConverter from "../converter/OpenSourceConfigConverter";
import ProxyConverter from "../converter/ProxyConverter";
import VersionConverter from "../converter/VersionConverter";
import OpenSourceConfigRepository from "../repository/OpenSourceConfigRepository";
import ProxyRepository from "../repository/ProxyRepository";
import VersionRepository from "../repository/VersionRepository";
import FrpcProcessService from "../service/FrpcProcessService";
import GitHubService from "../service/GitHubService";
import LogService from "../service/LogService";
import OpenSourceFrpcDesktopConfigService from "../service/OpenSourceFrpcDesktopConfigService";
import ProxyService from "../service/ProxyService";
import SystemService from "../service/SystemService";
import VersionService from "../service/VersionService";

const TYPES = {
  /**
   * converter
   */
  OpenSourceConfigConverter: Symbol.for("OpenSourceConfigConverter"),
  ProxyConverter: Symbol.for("ProxyConverter"),
  VersionConverter: Symbol.for("VersionConverter"),
  /** repository */
  OpenSourceConfigRepository: Symbol.for("OpenSourceConfigRepository"),
  VersionRepository: Symbol.for("VersionRepository"),
  ProxyRepository: Symbol.for("ProxyRepository"),
  /** service */
  SystemService: Symbol.for("SystemService"),
  OpenSourceFrpcDesktopConfigService: Symbol.for(
    "OpenSourceFrpcDesktopConfigService"
  ),
  GitHubService: Symbol.for("GitHubService"),
  VersionService: Symbol.for("VersionService"),
  LogService: Symbol.for("LogService"),
  FrpcProcessService: Symbol.for("FrpcProcessService"),
  ProxyService: Symbol.for("ProxyService"),

  /**
   * controller
   */
  SystemController: Symbol.for("SystemController"),
  VersionController: Symbol.for("VersionController"),
  LogController: Symbol.for("LogController"),
  LaunchController: Symbol.for("LaunchController"),
  ProxyController: Symbol.for("ProxyController"),
  FrpcDesktopApp: Symbol.for("FrpcDesktopApp"),
  ConfigController: Symbol.for("ConfigController")
};

/**
 * Main application runner class
 * Responsible for initializing and running the FrpcDesktop application
 */
class FrpcDesktopRunner {
  private readonly _container: Container = null;

  constructor() {
    this._container = new Container();
  }

  public run(): void {
    // core
    this._container
      .bind<FrpcDesktopApp>(TYPES.FrpcDesktopApp)
      .to(FrpcDesktopApp);
    // converter
    this._container
      .bind<OpenSourceConfigConverter>(TYPES.OpenSourceConfigConverter)
      .to(OpenSourceConfigConverter);
    this._container
      .bind<ProxyConverter>(TYPES.ProxyConverter)
      .to(ProxyConverter);
    this._container
      .bind<VersionConverter>(TYPES.VersionConverter)
      .to(VersionConverter);
    // repository
    this._container
      .bind<OpenSourceConfigRepository>(TYPES.OpenSourceConfigRepository)
      .to(OpenSourceConfigRepository);
    this._container
      .bind<ProxyRepository>(TYPES.ProxyRepository)
      .to(ProxyRepository);
    this._container
      .bind<VersionRepository>(TYPES.VersionRepository)
      .to(VersionRepository);
    /// service
    this._container.bind<SystemService>(TYPES.SystemService).to(SystemService);
    this._container
      .bind<OpenSourceFrpcDesktopConfigService>(
        TYPES.OpenSourceFrpcDesktopConfigService
      )
      .to(OpenSourceFrpcDesktopConfigService);
    this._container.bind<GitHubService>(TYPES.GitHubService).to(GitHubService);
    this._container
      .bind<VersionService>(TYPES.VersionService)
      .to(VersionService);
    this._container.bind<LogService>(TYPES.LogService).to(LogService);
    this._container
      .bind<FrpcProcessService>(TYPES.FrpcProcessService)
      .to(FrpcProcessService);
    this._container.bind<ProxyService>(TYPES.ProxyService).to(ProxyService);
    // controller
    this._container
      .bind<ConfigController>(TYPES.ConfigController)
      .to(ConfigController);
    this._container
      .bind<LaunchController>(TYPES.LaunchController)
      .to(LaunchController);
    this._container.bind<LogController>(TYPES.LogController).to(LogController);
    this._container
      .bind<ProxyController>(TYPES.ProxyController)
      .to(ProxyController);
    this._container
      .bind<SystemController>(TYPES.SystemController)
      .to(SystemController);
    this._container
      .bind<VersionController>(TYPES.VersionController)
      .to(VersionController);

    this._container.get<FrpcDesktopApp>(TYPES.FrpcDesktopApp);
  }
}

new FrpcDesktopRunner().run();

export { TYPES };
