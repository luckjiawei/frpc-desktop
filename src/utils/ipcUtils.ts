import { ipcRenderer } from "electron";
import { ElMessage } from "element-plus";
import { ResponseCode } from "../../electron/core/constant";

export const send = (channel: string, params?: any) => {
  ipcRenderer.send(channel, params);
};

// export const invoke = (router: IpcRouter, params?: any) => {
//   return new Promise((resolve, reject) => {
//     ipcRenderer
//       .invoke(router.path, params)
//       .then((args: ApiResponse<any>) => {
//         const { success, data, message } = args;
//         if (success) {
//           resolve(data);
//         } else {
//           // reject(new Error(message));
//         }
//       })
//       .catch(err => reject(err));
//   });
// };

export const on = (
  channel: string,
  onSuccess: (data: any) => void,
  onFail?: (bizCode: string, message: string) => void
) => {
  ipcRenderer.on(channel, (event, args: ApiResponse<any>) => {
    const { code, data, message } = args;
    console.log(`response => ${channel} , args => `, args);
    if (code === ResponseCode.SUCCESS.code) {
      onSuccess(data);
    } else {
      if (onFail) {
        onFail(code, message);
      } else {
        // ElMessageBox.alert(message,"出错了");
        ElMessage({
          message: message,
          type: "error"
        });
      }
      // reject(new Error(message));
    }
  });
};

export const onEvent = (
  channel: string,
  listener: (data: any) => void
) => {
  ipcRenderer.on(`${channel}`, (event, args: ApiResponse<any>) => {
    listener(args);
  });
};



export const removeRouterListeners = (channel: string) => {
  ipcRenderer.removeAllListeners(`${channel}`);
};

// export const removeRouterListeners2 = (listen: Listener) => {
//   ipcRenderer.removeAllListeners(`${listen.channel}`);
// };
// export const removeAllListeners = (listen: Listener) => {
//   ipcRenderer.removeAllListeners(`${listen.channel}:hook`);
// };
