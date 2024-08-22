import {app, BrowserWindow, ipcMain, Menu, MenuItem, MenuItemConstructorOptions, shell, Tray} from "electron";
import {release} from "node:os";
import node_path, {join} from "node:path";
import {initGitHubApi} from "../api/github";
import {initConfigApi} from "../api/config";
import {initProxyApi} from "../api/proxy";
import {initFrpcApi, startFrpWorkerProcess, stopFrpcProcess} from "../api/frpc";
import {initLoggerApi} from "../api/logger";
import {initFileApi} from "../api/file";
import {getConfig} from "../storage/config";
import log from "electron-log";
import {initCommonApi} from "../api/common";
import {initLocalApi} from "../api/local";
// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, "..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
    ? join(process.env.DIST_ELECTRON, "../public")
    : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;
let tray = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");
let isQuiting;
log.transports.file.level = 'debug';
log.transports.console.level = "debug";

async function createWindow() {
    win = new BrowserWindow({
        title: "Frpc Desktop",
        icon: join(process.env.VITE_PUBLIC, "logo/only/16x16.png"),
        width: 800,
        height: 600,
        minWidth: 640,
        minHeight: 480,
        maxWidth: 1280,
        maxHeight: 960,
        webPreferences: {
            preload,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            nodeIntegration: true,
            contextIsolation: false
        }
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
    win.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith("https:")) shell.openExternal(url);
        return {action: "deny"};
    });

    // 隐藏菜单栏
    const {Menu} = require("electron");
    Menu.setApplicationMenu(null);
    // hide menu for Mac
    // if (process.platform !== "darwin") {
    //     app.dock.hide();
    // }

    win.on('minimize', function (event) {
        event.preventDefault();
        win.hide();
    });

    win.on('close', function (event) {
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

export const createTray = () => {
    log.info(`当前环境 platform：${process.platform} arch：${process.arch} appData：${app.getPath("userData")} version:${app.getVersion()}`)
    let menu: Array<(MenuItemConstructorOptions) | (MenuItem)> = [
        {
            label: '显示主窗口', click: function () {
                win.show();
                if (process.platform === "darwin") {
                    app.dock.show();
                }
            }
        },
        {
            label: '退出',
            click: () => {
                isQuiting = true;
                stopFrpcProcess(() => {
                    app.quit();
                })
            }
        }
    ];
    tray = new Tray(node_path.join(process.env.VITE_PUBLIC, "logo/only/16x16.png"))
    tray.setToolTip('Frpc Desktop')
    const contextMenu = Menu.buildFromTemplate(menu)
    tray.setContextMenu(contextMenu)

    // 托盘双击打开
    tray.on('double-click', () => {
        win.show();
    })

    getConfig((err, config) => {
        if (!err) {
            if (config) {
                if (config.systemStartupConnect) {
                    log.info(`已开启自动连接 正在自动连接服务器`)
                    startFrpWorkerProcess(config)
                }
            }
        }
    })
}

app.whenReady().then(() => {
    createWindow().then(r => {
        createTray()
        // 初始化各个API
        initGitHubApi();
        initConfigApi(win);
        initProxyApi();
        initFrpcApi();
        initLoggerApi();
        initFileApi();
        initCommonApi();
        initLocalApi();
        // initUpdaterApi(win);
    })
});

app.on("window-all-closed", () => {
    win = null;
    if (process.platform !== "darwin") {
        stopFrpcProcess(() => {
            app.quit();
        })
    }
});

app.on("second-instance", () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

app.on("activate", () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        allWindows[0].focus();
    } else {
        createWindow();
    }
});

app.on('before-quit', () => {
    log.info("before-quit")
    isQuiting = true;
})

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
    const childWindow = new BrowserWindow({
        webPreferences: {
            preload,
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    if (process.env.VITE_DEV_SERVER_URL) {
        childWindow.loadURL(`${url}#${arg}`);
    } else {
        childWindow.loadFile(indexHtml, {hash: arg});
    }
});
