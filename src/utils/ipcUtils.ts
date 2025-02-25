import { ipcRenderer } from "electron";

export const send = (router: IpcRouter, params?: any) => {
  ipcRenderer.send(router.path, params);
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

export const on = (router: IpcRouter, listerHandler: (data: any) => void) => {
  ipcRenderer.on(`${router.path}:hook`, (event, args: ApiResponse<any>) => {
    const { success, data, message } = args;
    if (success) {
      listerHandler(data);
    } else {
      // reject(new Error(message));
    }
  });
};

export const onListener = (
  listener: Listener,
  listerHandler: (data: any) => void
) => {
  // return new Promise((resolve, reject) => {
  ipcRenderer.on(`${listener.channel}`, (event, args: ApiResponse<any>) => {
    const { success, data, message } = args;
    if (success) {
      listerHandler(data);
    }
  });
  // });
};

export const removeRouterListeners = (router: IpcRouter) => {
  ipcRenderer.removeAllListeners(`${router.path}:hook`);
};

export const removeRouterListeners2 = (listen: Listener) => {
  ipcRenderer.removeAllListeners(`${listen.channel}`);
}
// export const removeAllListeners = (listen: Listener) => {
//   ipcRenderer.removeAllListeners(`${listen.channel}:hook`);
// };
