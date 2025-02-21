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
import { release } from "node:os";
import node_path, { join } from "node:path";
import { initGitHubApi } from "../api/github";
import { initConfigApi } from "../api/config";
import { initProxyApi } from "../api/proxy";
import {
  initFrpcApi,
  startFrpWorkerProcess,
  stopFrpcProcess
} from "../api/frpc";
import { initFileApi } from "../api/file";
import { getConfig } from "../storage/config";
import { initCommonApi } from "../api/common";
import { initLocalApi } from "../api/local";
import { initLog, logError, logInfo, LogModule } from "../utils/log";
import { maskSensitiveData } from "../utils/desensitize";
import IpcRouterConfigurate from "../core/IpcRouter";

process.env.DIST_ELECTRON = join(__dirname, "..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

let win: BrowserWindow | null = null;
let tray = null;
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");
let isQuiting;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

async function createWindow(config: FrpConfig) {
  let show = true;
  if (config) {
    show = !config.systemSilentStartup;
  }
  win = new BrowserWindow({
    title: "Frpc Desktop",
    icon: join(process.env.VITE_PUBLIC, "logo/only/16x16.png"),
    width: 800,
    height: 600,
    minWidth: 800,
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
    show: show
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // 隐藏菜单栏
  const { Menu } = require("electron");
  Menu.setApplicationMenu(null);
  // hide menu for Mac
  // if (process.platform !== "darwin") {
  //     app.dock.hide();
  // }

  win.on("minimize", function (event) {
    event.preventDefault();
    win.hide();
  });

  win.on("close", function (event) {
    if (!isQuiting) {
      event.preventDefault();
      win.hide();
      if (process.platform === "darwin") {
        app.dock.hide();
      }
    }
    return false;
  });
}

export const createTray = (config: FrpConfig) => {
  let menu: Array<MenuItemConstructorOptions | MenuItem> = [
    {
      label: "显示主窗口",
      click: function () {
        win.show();
        if (process.platform === "darwin") {
          app.dock.show();
        }
      }
    },
    {
      label: "退出",
      click: () => {
        isQuiting = true;
        stopFrpcProcess(() => {
          app.quit();
        });
      }
    }
  ];
  tray = new Tray(
    node_path.join(process.env.VITE_PUBLIC, "logo/only/16x16.png")
  );
  tray.setToolTip("Frpc Desktop");
  const contextMenu = Menu.buildFromTemplate(menu);
  tray.setContextMenu(contextMenu);

  // 托盘双击打开
  tray.on("double-click", () => {
    win.show();
  });

  logInfo(LogModule.APP, `Tray created successfully.`);
};
app.whenReady().then(() => {
  initLog();
  logInfo(
    LogModule.APP,
    `Application started. Current system architecture: ${
      process.arch
    }, platform: ${process.platform}, version: ${app.getVersion()}.`
  );

  getConfig((err, config) => {
    if (err) {
      logError(LogModule.APP, `Failed to get config: ${err.message}`);
      return;
    }

    createWindow(config)
      .then(r => {
        logInfo(LogModule.APP, `Window created successfully.`);
        createTray(config);

        if (config) {
          logInfo(
            LogModule.APP,
            `Config retrieved: ${JSON.stringify(
              maskSensitiveData(config, [
                "serverAddr",
                "serverPort",
                "authToken",
                "user",
                "metaToken"
              ])
            )}`
          );

          if (config.systemStartupConnect) {
            startFrpWorkerProcess(config);
          }
        }
        const ipcRouterConfig = new IpcRouterConfigurate(win);
        // Initialize APIs
        try {
          initGitHubApi(win);
          logInfo(LogModule.APP, `GitHub API initialized.`);

          initConfigApi(win);
          logInfo(LogModule.APP, `Config API initialized.`);

          initProxyApi();
          logInfo(LogModule.APP, `Proxy API initialized.`);

          initFrpcApi();
          logInfo(LogModule.APP, `FRPC API initialized.`);

          // logInfo(LogModule.APP, `Logger API initialized.`);

          initFileApi();
          logInfo(LogModule.APP, `File API initialized.`);

          initCommonApi();
          logInfo(LogModule.APP, `Common API initialized.`);

          initLocalApi();
          logInfo(LogModule.APP, `Local API initialized.`);

          // initUpdaterApi(win);
          logInfo(LogModule.APP, `Updater API initialization skipped.`);
        } catch (error) {
          logError(
            LogModule.APP,
            `Error during API initialization: ${error.message}`
          );
        }
      })
      .catch(error => {
        logError(LogModule.APP, `Error creating window: ${error.message}`);
      });
  });
});

app.on("window-all-closed", () => {
  logInfo(LogModule.APP, `All windows closed.`);
  win = null;
  if (process.platform !== "darwin") {
    stopFrpcProcess(() => {
      logInfo(LogModule.APP, `FRPC process stopped. Quitting application.`);
      app.quit();
    });
  }
});

app.on("second-instance", () => {
  logInfo(LogModule.APP, `Second instance detected.`);
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  logInfo(LogModule.APP, `Application activated.`);
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    getConfig((err, config) => {
      if (err) {
        logError(
          LogModule.APP,
          `Failed to get config on activate: ${err.message}`
        );
        return;
      }
      createWindow(config).then(r => {
        logInfo(LogModule.APP, `Window created on activate.`);
      });
    });
  }
});

app.on("before-quit", () => {
  logInfo(LogModule.APP, `Application is about to quit.`);
  stopFrpcProcess(() => {
    isQuiting = true;
  });
});

ipcMain.handle("open-win", (_, arg) => {
  logInfo(LogModule.APP, `Opening new window with argument: ${arg}`);
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
    logInfo(LogModule.APP, `Child window loaded URL: ${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
    logInfo(
      LogModule.APP,
      `Child window loaded file: ${indexHtml} with hash: ${arg}`
    );
  }
});
