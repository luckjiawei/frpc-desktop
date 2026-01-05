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


import knex from "knex";
import log from "electron-log/main";
import PathUtils from "../utils/PathUtils";
import MonitorEvent from "../event/monitor";
import FrpcProcessEvent from "../event/frpc-process";

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
    // event
    this._container.bind<MonitorEvent>(TYPES.SystemEvent).to(MonitorEvent);
    this._container.bind<FrpcProcessEvent>(TYPES.FrpcProcessEvent).to(FrpcProcessEvent);
  }

  public run(): void {
    this.initializeLog();
    this.initializeDatabase();
    this.initializeContainer();
    this.initializeController();
    const app = this._container.get<FrpcDesktopApp>(TYPES.FrpcDesktopApp);

    app.run(() => {
      this.initializeEvent();
    });
  }

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
    this._container.get<ProxyController>(TYPES.ProxyController);
    this._container.get<SystemController>(TYPES.SystemController);
    this._container.get<VersionController>(TYPES.VersionController);
  }

  /**
   * Initialize event
   */
  private initializeEvent() {
    this._container.get<MonitorEvent>(TYPES.SystemEvent);
    this._container.get<FrpcProcessEvent>(TYPES.FrpcProcessEvent);
  }
}
new FrpcDesktopRunner().run();

