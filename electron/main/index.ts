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
  private _quitting = false;

  constructor() {
    this.initializeBeans();
    this.initializeListeners();
    this.initializeRouters();
    this.initializeElectronApp();
  }

  async initializeWindow() {
    if (this._win) {
      return;
    }
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

  initializeTray() {
    const that = this;
    const menu: Array<MenuItemConstructorOptions | MenuItem> = [
      {
        label: "显示主窗口",
        click: function () {
          that._win.show();
          if (process.platform === "darwin") {
            app.dock.show().then(() => {});
          }
        }
      },
      {
        label: "退出",
        click: () => {
          that._quitting = true;
          // todo stop frpc process
          const frpcProcessService: FrpcProcessService =
            BeanFactory.getBean("frpcProcessService");
          frpcProcessService.stopFrpcProcess().finally(() => {
            app.quit();
          });
        }
      }
    ];
    const tray = new Tray(
      node_path.join(process.env.VITE_PUBLIC, "logo/only/16x16.png")
    );
    tray.setToolTip(app.getName());
    const contextMenu = Menu.buildFromTemplate(menu);
    tray.setContextMenu(contextMenu);

    // 托盘双击打开
    tray.on("double-click", () => {
      this._win.show();
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
    app.whenReady().then(() => {
      this.initializeWindow().then(() => {});
      this.initializeTray();
    });

    app.on("window-all-closed", () => {
      this._win = null;
      if (process.platform !== "darwin") {
        const frpcProcessService: FrpcProcessService =
          BeanFactory.getBean("frpcProcessService");
        frpcProcessService.stopFrpcProcess().finally(() => {
          app.quit();
        });
      }
    });

    app.on("second-instance", () => {
      if (this._win) {
        if (this._win.isMinimized()) this._win.show();
        if (!this._win.isVisible()) this._win.show();
        this._win.focus();
      }
    });

    app.on("activate", () => {
      const allWindows = BrowserWindow.getAllWindows();
      if (allWindows.length) {
        allWindows[0].focus();
      } else {
        this.initializeWindow();
      }
    });

    app.on("before-quit", () => {
      this._quitting = true;
      const frpcProcessService: FrpcProcessService =
        BeanFactory.getBean("frpcProcessService");
      frpcProcessService.stopFrpcProcess().finally(() => {});
    });

    Logger.info(
      `FrpcDesktopApp.initializeElectronApp`,
      `ElectronApp initialized.`
    );
  }

  initializeBeans() {
    BeanFactory.setBean("serverRepository", new ServerRepository());
    BeanFactory.setBean("versionRepository", new VersionRepository());
    BeanFactory.setBean("proxyRepository", new ProxyRepository());
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
        BeanFactory.getBean("frpcProcessService")
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
