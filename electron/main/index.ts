import "reflect-metadata";

import { app } from "electron";
import { join } from "node:path";

import { TYPES } from "../di"
process.env.DIST = join(__dirname, "../../dist");
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : join(process.env.DIST, "../public");

import { Container } from "inversify";
import { FrpcDesktopApp } from "./app";
import ConfigController from "../controller/config";
import LaunchController from "../controller/launch";
import LogController from "../controller/log";
import ProxiesController from "../controller/proxies";
import SystemController from "../controller/system";
import VersionController from "../controller/versions";
import OpenSourceConfigConverter from "../converter/config";
import ProxiesConverter from "../converter/proxies";
import VersionConverter from "../converter/versions";
import OpenSourceConfigRepository from "../repository/config";
import ProxiesRepository from "../repository/proxies";
import VersionRepository from "../repository/versions";
import FrpcProcessService from "../service/frpc-process";
import GitHubService from "../service/github";
import LogService from "../service/log";
import OpenSourceFrpcDesktopConfigService from "../service/OpenSourceFrpcDesktopConfigService";
import ProxiesService from "../service/proxies";
import SystemService from "../service/system";
import VersionService from "../service/versions";


import knex from "knex";
import log from "electron-log/main";
import PathUtils from "../utils/PathUtils";
import SystemEvent from "../event/system";
import FrpcProcessEvent from "../event/frpc-process";
import { LogLevel } from "electron-log";

/**
 * Main application runner class
 * Responsible for initializing and running the FrpcDesktop application
 */
class FrpcDesktopRunner {
  private readonly _container: Container = null;

  constructor() {
    this._container = new Container();
  }

  private initializeContainer(): void {
    // core
    this._container
      .bind<Container>(TYPES.Container)
      .toConstantValue(this._container);
    this._container.bind<FrpcDesktopApp>(TYPES.FrpcDesktopApp).to(FrpcDesktopApp);
    // converter
    this._container
      .bind<OpenSourceConfigConverter>(TYPES.OpenSourceConfigConverter)
      .to(OpenSourceConfigConverter);
    this._container
      .bind<ProxiesConverter>(TYPES.ProxiesConverter)
      .to(ProxiesConverter);
    this._container
      .bind<VersionConverter>(TYPES.VersionConverter)
      .to(VersionConverter);
    // repository
    this._container
      .bind<OpenSourceConfigRepository>(TYPES.OpenSourceConfigRepository)
      .to(OpenSourceConfigRepository);
    this._container
      .bind<ProxiesRepository>(TYPES.ProxiesRepository)
      .to(ProxiesRepository);
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
    this._container.bind<ProxiesService>(TYPES.ProxiesService).to(ProxiesService);
    // controller
    this._container
      .bind<ConfigController>(TYPES.ConfigController)
      .to(ConfigController);
    this._container
      .bind<LaunchController>(TYPES.LaunchController)
      .to(LaunchController);
    this._container.bind<LogController>(TYPES.LogController).to(LogController);
    this._container
      .bind<ProxiesController>(TYPES.ProxiesController)
      .to(ProxiesController);
    this._container
      .bind<SystemController>(TYPES.SystemController)
      .to(SystemController);
    this._container
      .bind<VersionController>(TYPES.VersionController)
      .to(VersionController);
    // event
    this._container.bind<SystemEvent>(TYPES.SystemEvent).to(SystemEvent);
    this._container.bind<FrpcProcessEvent>(TYPES.FrpcProcessEvent).to(FrpcProcessEvent);
  }

  public run(): void {
    this.initializeLog();
    this.initializeDatabase();
    this.initializeContainer();
    this.initializeController();

    const configService = this._container.get<OpenSourceFrpcDesktopConfigService>(TYPES.OpenSourceFrpcDesktopConfigService);
    configService.getServerConfig().then(config => {
      if (config && config.log) {
        log.transports.file.level = config.log.level as LogLevel;
        log.transports.console.level = config.log.level as LogLevel;
      }
    })

    const app = this._container.get<FrpcDesktopApp>(TYPES.FrpcDesktopApp);

    app.run(() => {
      this.initializeEvent();
    });
  }

  /**
   * Initialize logging
   */
  private initializeLog(): void {
    log.initialize();
    log.transports.file.level = "info";
    log.transports.console.level = "info";
    log.transports.file.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}";
    log.transports.console.format =
      "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}";

    log.scope("main").info("Log initialized");
  }

  private initializeDatabase(): void {
    const db: knex.Knex = knex({
      client: "sqlite",
      useNullAsDefault: true,
      connection: {
        filename: PathUtils.getDatabaseFilename()
      },
      log: {
        debug(message) {
          log.scope("knex").debug(message);
        },
        warn(message) {
          log.scope("knex").warn(message);
        },
        error(message) {
          log.scope("knex").error(message);
        }
      }
    });
    this._container.bind<knex.Knex>(TYPES.Knex).toConstantValue(db);
    log.scope("knex").info("Database initialized.");
  }

  /**
   * Initialize controller
   */
  private initializeController() {
    this._container.get<ConfigController>(TYPES.ConfigController);
    this._container.get<LaunchController>(TYPES.LaunchController);
    this._container.get<LogController>(TYPES.LogController);
    this._container.get<ProxiesController>(TYPES.ProxiesController);
    this._container.get<SystemController>(TYPES.SystemController);
    this._container.get<VersionController>(TYPES.VersionController);
  }

  /**
   * Initialize event
   */
  private initializeEvent() {
    this._container.get<SystemEvent>(TYPES.SystemEvent);
    this._container.get<FrpcProcessEvent>(TYPES.FrpcProcessEvent);
  }
}

/**
 * start main process
 */
new FrpcDesktopRunner().run();

