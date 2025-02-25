// import {dialog, ipcMain} from "electron";
// import { logInfo, logError, LogModule } from "../utils/log";
//
// export const initFileApi = () => {
//     ipcMain.handle("file.selectFile", async (event, args) => {
//         logInfo(LogModule.APP, `Attempting to open file dialog with filters: ${JSON.stringify(args)}`);
//         try {
//             const result = dialog.showOpenDialogSync({
//                 properties: ['openFile'],
//                 filters: [
//                     { name: 'Text Files', extensions: args },
//                 ]
//             });
//             logInfo(LogModule.APP, `File dialog result: ${JSON.stringify(result)}`);
//             return result;
//         } catch (error) {
//             logError(LogModule.APP, `Error opening file dialog: ${error.message}`);
//             return null;
//         }
//     });
// }
