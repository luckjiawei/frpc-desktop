import {app, dialog, autoUpdater } from "electron";

const log = require('electron-log');


export const initUpdaterApi = () => {
    const server = 'https://hazel-jplav4y84-uiluck.vercel.app'
    const url = `${server}/update/${process.platform}/${app.getVersion()}`
    autoUpdater.setFeedURL({ url })
    setInterval(() => {
    }, 60000)
    autoUpdater.checkForUpdates()

    // autoUpdater.on('checking-for-update', () => {
    //     log.info("正在检查更新")
    // })
    //
    // autoUpdater.on('update-available', () => {
    //     log.info("有可用更新")
    // })
    //
    // autoUpdater.on('update-not-available', () => {
    //     log.info('没有可用的更新')
    // })
    //
    // autoUpdater.on('error', (err) => {
    //     log.error(`更新错误：${err.message}`)
    //
    // })
    //
    // autoUpdater.on('download-progress', (progressObj) => {
    //     log.debug(`下载进度 ${progressObj.percent}%`)
    // })
    //
    // autoUpdater.on('update-downloaded', () => {
    //     console.log('update-downloaded')
    //
    //     dialog.showMessageBox({
    //         type: 'info',
    //         title: '应用更新',
    //         message: '发现新版本，是否更新？',
    //         buttons: ['是', '否']
    //     }).then((buttonIndex) => {
    //         if (buttonIndex.response == 0) {  //选择是，则退出程序，安装新版本
    //             autoUpdater.quitAndInstall()
    //             app.quit()
    //         }
    //     })
    // })

}
