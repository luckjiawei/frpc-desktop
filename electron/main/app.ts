import "reflect-metadata";

import { injectable, inject, Container } from "inversify";
import OpenSourceFrpcDesktopConfigService from "../service/config";
import { TYPES } from "../di";
import log from "electron-log/main";
import PathUtils from "../utils/PathUtils";
import FrpcProcessService from "../service/frpc-process";
import node_path, { join } from "node:path";
import { release } from "node:os";

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

/**
 * Main application class for Frpc Desktop
 * Responsible for initializing and managing the Electron application lifecycle
 */
@injectable()
export class FrpcDesktopApp {
  private _win: Electron.BrowserWindow | null = null;
  private _quitting = false;
  private readonly _openSourceFrpcDesktopConfigService: OpenSourceFrpcDesktopConfigService =
    null;
  private readonly _frpcProcessService: FrpcProcessService = null;
  private readonly _preload = join(__dirname, "../preload/index.js");
  private readonly _url = process.env.VITE_DEV_SERVER_URL;
  private readonly _indexHtml = join(process.env.DIST, "index.html");
  private readonly _container: Container;

  constructor(
    @inject(TYPES.OpenSourceFrpcDesktopConfigService)
    openSourceFrpcDesktopConfigService: OpenSourceFrpcDesktopConfigService,
    @inject(TYPES.FrpcProcessService)
    frpcProcessService: FrpcProcessService,
    @inject(TYPES.Container) container: Container
  ) {
    this._container = container;
    this._openSourceFrpcDesktopConfigService =
      openSourceFrpcDesktopConfigService;
    this._frpcProcessService = frpcProcessService;
    // initializeLog();
    // initializeDatabase();
    // initializeBeans();
    // this.initializeListeners();
    // this.initializeRouters();
    // this.initializeElectronApp();
  }

  public run(windowReadyCallback: () => void): void {
    this.initializeElectronApp(windowReadyCallback);

    log.scope("main").info("FrpcDesktopApp Version " + app.getVersion());
    log.scope("main").info("Process argv: " + process.argv.join(" "));
    log.scope("main").info("Process cwd: " + process.cwd());
    log.scope("main").info("Process execPath: " + process.execPath);
    log.scope("main").info("Process platform: " + process.platform);
    log.scope("main").info("Process arch: " + process.arch);
    log.scope("main").info("Process node version: " + process.versions.node);
    log
      .scope("main")
      .info("Process electron version: " + process.versions.electron);
  }

  /**
   *
   * @returns
   */
  private async initializeWindow(): Promise<void> {
    if (this._win) {
      return;
    }
    if (
      await this._openSourceFrpcDesktopConfigService.isAutoConnectOnStartup()
    ) {
      this._frpcProcessService
        .startFrpcProcess()
        .then(() => {
          log.scope("main").info("Auto connect completed");
        })
        .catch(error => {
          log.scope("main").error("Auto connect failed", error);
        });
    }
    const self = this;

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
        preload: self._preload,
        // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
        // Consider using contextBridge.exposeInMainWorld
        // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
        nodeIntegration: true,
        contextIsolation: false
      },
      show: !(await this._openSourceFrpcDesktopConfigService.isSilentStart())
    });
    this._container.bind(TYPES.BrowserWindow).toConstantValue(this._win);
    if (process.env.VITE_DEV_SERVER_URL) {
      // electron-vite-vue#298
      this._win.loadURL(this._url).then(() => {});
      // Open devTool if the app is not packaged
      this._win.webContents.openDevTools();
    } else {
      this._win.loadFile(this._indexHtml).then(() => {});
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
    log.scope("main").info("Main Window initialized.");
  }

  /**
   * 托盘
   */
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
          that._frpcProcessService.stopFrpcProcess().finally(() => {
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
    log.scope("main").info("Tray initialized.");
  }

  async initializeElectronApp(windowReadyCallback: () => void) {
    // Disable GPU Acceleration for Windows 7
    if (release().startsWith("6.1")) app.disableHardwareAcceleration();

    // Set application name for Windows 10+ notifications
    if (process.platform === "win32") app.setAppUserModelId(app.getName());

    if (!app.requestSingleInstanceLock()) {
      app.quit();
      process.exit(0);
    }
    app.whenReady().then(() => {
      this.initializeWindow().then(() => {
        windowReadyCallback();
      });
      this.initializeTray();
    });

    app.on("window-all-closed", () => {
      this._win = null;
      if (process.platform !== "darwin") {
        this._frpcProcessService.stopFrpcProcess().finally(() => {
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
        this.initializeWindow().then(() => {
          windowReadyCallback();
        });
      }
    });

    app.on("before-quit", () => {
      // todo stop frpc process
      this._quitting = true;
      this._frpcProcessService.stopFrpcProcess().finally(() => {});
    });

    log.scope("main").info(`ElectronApp initialized successfully.`);
  }
}
