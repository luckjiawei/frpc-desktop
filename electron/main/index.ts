import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  shell,
  Tray
} from "electron";
import { release, totalmem, cpus } from "node:os";
import node_path, { join } from "node:path";
import ConfigController from "../controller/ConfigController";
import LaunchController from "../controller/LaunchController";
import LogController from "../controller/LogController";
import ProxyController from "../controller/ProxyController";
import SystemController from "../controller/SystemController";
import VersionController from "../controller/VersionController";
import BeanFactory from "../core/BeanFactory";
import { ipcRouters, listeners } from "../core/IpcRouter";
import Logger from "../core/Logger";
import DatabaseManager from "../database/DatabaseManager";
import NedbMigrationService from "../database/NedbMigrationService";
import AppConfigRepository from "../repository/AppConfigRepository";
import ProxyRepository from "../repository/ProxyRepository";
import ServerRepository from "../repository/ServerRepository";
import VersionRepository from "../repository/VersionRepository";
import FrpcProcessService from "../service/FrpcProcessService";
import GitHubService from "../service/GitHubService";
import LogService from "../service/LogService";
import ProxyService from "../service/ProxyService";
import ServerService from "../service/ServerService";
import SystemService from "../service/SystemService";
import VersionService from "../service/VersionService";

process.env.DIST_ELECTRON = join(__dirname, "..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

class FrpcDesktopApp {
  private _win: BrowserWindow | null = null;
  private _tray: Tray | null = null;
  private _quitting = false;

  constructor() {
    this.initializeElectronApp();
  }

  async initializeWindow() {
    if (this._win && !this._win.isDestroyed()) {
      return;
    }
    this._win = null;
    const serverService: ServerService = BeanFactory.getBean("serverService");
    Logger.setLevel(await serverService.getLoggerLevel());
    Logger.info(
      `FrpcDesktopApp.initializeWindow`,
      [
        `=== Application Started ===`,
        `App       : ${app.getName()} v${app.getVersion()}`,
        `Platform  : ${process.platform} / ${process.arch}`,
        `OS Release: ${release()}`,
        `Node.js   : ${process.versions.node}`,
        `Electron  : ${process.versions.electron}`,
        `Chrome    : ${process.versions.chrome}`,
        `CPU       : ${cpus()[0]?.model ?? "unknown"} (${cpus().length} cores)`,
        `Memory    : ${(totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        `Log Level : ${(await serverService.getLoggerLevel()) || "info"}`
      ].join("\n")
    );
    if (await serverService.isAutoConnectOnStartup()) {
      const frpcProcessService: FrpcProcessService =
        BeanFactory.getBean("frpcProcessService");
      frpcProcessService.startFrpcProcess().then(() => {
        Logger.info(
          `FrpcDesktopApp.initializeWindow`,
          `AutoConnectOnStartup Completed.`
        );
      });
    }

    this._win = new BrowserWindow({
      title: `${app.getName()} v${app.getVersion()} (${process.arch})`,
      icon: join(process.env.VITE_PUBLIC, "logo/only/16x16.png"),
      width: 900,
      height: 600,
      minWidth: 900,
      minHeight: 600,
      maxWidth: 1280,
      maxHeight: 960,
      webPreferences: {
        preload,
        // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
        // Consider using contextBridge.exposeInMainWorld
        // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
        nodeIntegration: true,
        contextIsolation: false
      },
      show: !(await serverService.isSilentStart())
    });
    BeanFactory.setBean("win", this._win);
    if (process.env.VITE_DEV_SERVER_URL) {
      // electron-vite-vue#298
      this._win.loadURL(url).then(() => {});
      // Open devTool if the app is not packaged
      this._win.webContents.openDevTools();
    } else {
      this._win.loadFile(indexHtml).then(() => {});
    }

    this._win.webContents.on("did-finish-load", () => {
      this._win?.webContents.send(
        "main-process-message",
        new Date().toLocaleString()
      );
    });
    this._win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https:")) shell.openExternal(url);
      return { action: "deny" };
    });
    Menu.setApplicationMenu(null);

    const that = this;
    (this._win as any).on("minimize", function (event: any) {
      event.preventDefault();
      that._win.hide();
    });

    this._win.on("close", function (event) {
      if (!that._quitting) {
        event.preventDefault();
        that._win.hide();
        if (process.platform === "darwin") {
          app.dock.hide();
        }
      }
      return false;
    });
    Logger.info(`FrpcDesktopApp.initializeWindow`, `Window initialized.`);
  }

  private async showMainWindow() {
    if (this._quitting) {
      return;
    }
    if (!this._win || this._win.isDestroyed()) {
      await this.initializeWindow();
    }
    const win = this._win;
    if (!win || win.isDestroyed()) {
      return;
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
    if (process.platform === "darwin") {
      await app.dock.show();
    }
  }

  private destroyTray() {
    if (this._tray && !this._tray.isDestroyed()) {
      this._tray.destroy();
    }
    this._tray = null;
  }

  initializeTray() {
    if (this._tray && !this._tray.isDestroyed()) {
      return;
    }
    const menu: Array<MenuItemConstructorOptions | MenuItem> = [
      {
        label: "显示主窗口",
        click: () => {
          this.showMainWindow().catch(error => {
            Logger.error(
              `FrpcDesktopApp.showMainWindow`,
              error instanceof Error ? error : new Error(String(error))
            );
          });
        }
      },
      {
        label: "退出",
        click: () => {
          this._quitting = true;
          this.destroyTray();
          // todo stop frpc process
          const frpcProcessService: FrpcProcessService =
            BeanFactory.getBean("frpcProcessService");
          frpcProcessService
            .stopFrpcProcess()
            .catch(error => {
              Logger.error(
                `FrpcDesktopApp.initializeTray`,
                error instanceof Error ? error : new Error(String(error))
              );
            })
            .finally(() => {
              app.quit();
            });
        }
      }
    ];
    this._tray = new Tray(
      node_path.join(process.env.VITE_PUBLIC, "logo/only/16x16.png")
    );
    this._tray.setToolTip(app.getName());
    const contextMenu = Menu.buildFromTemplate(menu);
    this._tray.setContextMenu(contextMenu);

    // 托盘双击打开
    this._tray.on("double-click", () => {
      this.showMainWindow().catch(error => {
        Logger.error(
          `FrpcDesktopApp.showMainWindow`,
          error instanceof Error ? error : new Error(String(error))
        );
      });
    });
    Logger.info(`FrpcDesktopApp.initializeTray`, `Tray initialized.`);
  }

  initializeElectronApp() {
    // Disable GPU Acceleration for Windows 7
    if (release().startsWith("6.1")) app.disableHardwareAcceleration();

    // Set application name for Windows 10+ notifications
    if (process.platform === "win32") app.setAppUserModelId(app.getName());

    if (!app.requestSingleInstanceLock()) {
      app.quit();
      process.exit(0);
    }
    app
      .whenReady()
      .then(async () => {
        const databaseManager = new DatabaseManager();
        BeanFactory.setBean("databaseManager", databaseManager);
        databaseManager.initialize();
        const database = databaseManager.getDatabase();
        const appConfigRepository = new AppConfigRepository(database);
        const serverRepository = new ServerRepository(
          database,
          appConfigRepository
        );
        const versionRepository = new VersionRepository(database);
        const proxyRepository = new ProxyRepository(database);
        const nedbMigrationService = new NedbMigrationService(
          database,
          appConfigRepository,
          serverRepository,
          proxyRepository,
          versionRepository
        );
        await nedbMigrationService.migrate();
        this.initializeBeans(
          appConfigRepository,
          serverRepository,
          versionRepository,
          proxyRepository
        );
        this.initializeListeners();
        this.initializeRouters();
        await this.initializeWindow();
        this.initializeTray();
      })
      .catch(error => {
        Logger.error(
          `FrpcDesktopApp.initializeElectronApp`,
          error instanceof Error ? error : new Error(String(error))
        );
        app.quit();
      });

    app.on("window-all-closed", () => {
      this._win = null;
      if (process.platform !== "darwin") {
        this._quitting = true;
        this.destroyTray();
        const frpcProcessService: FrpcProcessService =
          BeanFactory.getBean("frpcProcessService");
        frpcProcessService
          .stopFrpcProcess()
          .catch(error => {
            Logger.error(
              `FrpcDesktopApp.window-all-closed`,
              error instanceof Error ? error : new Error(String(error))
            );
          })
          .finally(() => {
            app.quit();
          });
      }
    });

    app.on("second-instance", () => {
      this.showMainWindow().catch(error => {
        Logger.error(
          `FrpcDesktopApp.showMainWindow`,
          error instanceof Error ? error : new Error(String(error))
        );
      });
    });

    app.on("activate", () => {
      this.showMainWindow().catch(error => {
        Logger.error(
          `FrpcDesktopApp.showMainWindow`,
          error instanceof Error ? error : new Error(String(error))
        );
      });
    });

    app.on("before-quit", () => {
      this._quitting = true;
      this.destroyTray();
      if (BeanFactory.hasBean("frpcProcessService")) {
        const frpcProcessService: FrpcProcessService =
          BeanFactory.getBean("frpcProcessService");
        frpcProcessService.stopFrpcProcess().catch(error => {
          Logger.error(
            `FrpcDesktopApp.before-quit`,
            error instanceof Error ? error : new Error(String(error))
          );
        });
      }
    });

    app.on("will-quit", () => {
      if (BeanFactory.hasBean("databaseManager")) {
        const databaseManager: DatabaseManager =
          BeanFactory.getBean("databaseManager");
        databaseManager.close();
      }
    });

    Logger.info(
      `FrpcDesktopApp.initializeElectronApp`,
      `ElectronApp initialized.`
    );
  }

  initializeBeans(
    appConfigRepository: AppConfigRepository,
    serverRepository: ServerRepository,
    versionRepository: VersionRepository,
    proxyRepository: ProxyRepository
  ) {
    BeanFactory.setBean("appConfigRepository", appConfigRepository);
    BeanFactory.setBean("serverRepository", serverRepository);
    BeanFactory.setBean("versionRepository", versionRepository);
    BeanFactory.setBean("proxyRepository", proxyRepository);
    BeanFactory.setBean("systemService", new SystemService());
    BeanFactory.setBean(
      "serverService",
      new ServerService(
        BeanFactory.getBean("serverRepository"),
        BeanFactory.getBean("proxyRepository")
      )
    );
    BeanFactory.setBean("gitHubService", new GitHubService());
    BeanFactory.setBean(
      "versionService",
      new VersionService(
        BeanFactory.getBean("versionRepository"),
        BeanFactory.getBean("systemService"),
        BeanFactory.getBean("gitHubService")
      )
    );
    BeanFactory.setBean(
      "logService",
      new LogService(BeanFactory.getBean("systemService"))
    );
    BeanFactory.setBean("frpcProcessService", new FrpcProcessService());
    BeanFactory.setBean(
      "proxyService",
      new ProxyService(
        BeanFactory.getBean("proxyRepository"),
        BeanFactory.getBean("frpcProcessService")
      )
    );
    BeanFactory.setBean(
      "configController",
      new ConfigController(
        BeanFactory.getBean("serverService"),
        BeanFactory.getBean("systemService"),
        BeanFactory.getBean("frpcProcessService"),
        BeanFactory.getBean("databaseManager")
      )
    );
    BeanFactory.setBean(
      "versionController",
      new VersionController(
        BeanFactory.getBean("versionService"),
        BeanFactory.getBean("versionRepository")
      )
    );
    BeanFactory.setBean(
      "logController",
      new LogController(BeanFactory.getBean("logService"))
    );
    BeanFactory.setBean(
      "launchController",
      new LaunchController(BeanFactory.getBean("frpcProcessService"))
    );
    BeanFactory.setBean(
      "proxyController",
      new ProxyController(
        BeanFactory.getBean("proxyService"),
        BeanFactory.getBean("proxyRepository")
      )
    );
    BeanFactory.setBean("systemController", new SystemController());
    Logger.info(`FrpcDesktopApp.initializeBeans`, `Beans initialized.`);
  }

  /**
   * initJob
   * @private
   */
  private initializeListeners() {
    Object.keys(listeners).forEach(listenerKey => {
      const { listenerMethod, channel } = listeners[listenerKey];
      const [beanName, method] = listenerMethod.split(".");
      const bean = BeanFactory.getBean(beanName);
      const listenerParam: ListenerParam = {
        // win: BeanFactory.getBean("win"),
        channel: channel,
        args: []
      };
      bean[method].call(bean, listenerParam);
    });
    Logger.info(`FrpcDesktopApp.initializeListeners`, `Listeners initialized.`);
    // this._beans.get("logService").watchFrpcLog(this._win);
  }

  /**
   * initRouters
   * @private
   */
  private initializeRouters() {
    Object.keys(ipcRouters).forEach(routerKey => {
      const routerGroup = ipcRouters[routerKey];

      Object.keys(routerGroup).forEach(method => {
        const router = routerGroup[method];
        ipcMain.on(router.path, (event, args) => {
          const req: ControllerParam = {
            // win: BeanFactory.getBean("win"),
            channel: `${router.path}:hook`,
            event: event,
            args: args
          };
          const [beanName, method] = router.controller.split(".");
          const bean = BeanFactory.getBean(beanName);
          bean[method].call(bean, req);
          Logger.debug(
            `ipcRouter`,
            `path: ${router.path} + req: (channel: ${
              req.channel
            }, args: ${JSON.stringify(
              req.args
            )}) => bean: ${beanName}.${method}`
          );
        });
      });
    });
    Logger.info(`FrpcDesktopApp.initializeRouters`, `Routers initialized.`);
  }
}

new FrpcDesktopApp();
