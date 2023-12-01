import {dialog, ipcMain} from "electron";

export const initFileApi = () => {
    ipcMain.handle("file.selectFile", async (event, args) => {
        const result = dialog.showOpenDialogSync({
            properties: ['openFile'],
            filters: [
                {name: 'Text Files', extensions: args},
            ]
        })
        return result;
    });
}
