import {app, dialog, autoUpdater} from "electron";

const log = require('electron-log');


export const initUpdaterApi = () => {

    const server = 'https://hazel-git-master-uiluck.vercel.app'
    let packageName = null
    const platform = process.platform;
    const arch = process.arch;
    switch (platform) {
        case "darwin":
            if (arch == "arm64") {
                packageName = "dmg_arm64";
            } else {
                packageName = "dmg";
            }
            break;
        case "win32":
            packageName = "exe";
            break;
        case "linux":
            packageName = "AppImage";
            if (arch == "arm64") {
                packageName = "AppImage_arm64";
            } else {
                packageName = "AppImage";
            }
            break;
    }
    const url = `${server}/update/${packageName}/${app.getVersion()}`
    log.info(`开启自动更新 ${url}`);
    autoUpdater.setFeedURL({url})

    autoUpdater.on('checking-for-update', () => {
        log.info("正在检查更新")
    })

    autoUpdater.on('update-available', () => {
        log.info("有可用更新")
    })

    autoUpdater.on('update-not-available', () => {
        log.info('没有可用的更新')
    })

    autoUpdater.on('error', (err) => {
        log.error(`更新错误：${err.message}`)

    })

    // autoUpdater.on('download-progress', (progressObj) => {
    //     log.debug(`下载进度 ${progressObj.percent}%`)
    // })

    autoUpdater.on('update-downloaded', () => {
        console.log('update-downloaded')

        dialog.showMessageBox({
            type: 'info',
            title: '应用更新',
            message: '发现新版本，是否更新？',
            buttons: ['是', '否']
        }).then((buttonIndex) => {
            if (buttonIndex.response == 0) {  //选择是，则退出程序，安装新版本
                autoUpdater.quitAndInstall()
                app.quit()
            }
        })
    })

    // setInterval(() => {
    //     log.initialize("定时检查更新")
    //     // autoUpdater.checkForUpdates();
    // }, 60000)
    autoUpdater.checkForUpdates();
    log.info("手动检查更新一次")


}
