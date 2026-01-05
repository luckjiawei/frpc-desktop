import { ipcRenderer } from "electron";
import { ElMessage } from "element-plus";
import { ResponseCode } from "../../electron/core/constant";

// 存储监听器引用，用于精确清理
type IpcListener = (event: Electron.IpcRendererEvent, ...args: any[]) => void;
const listenerMap = new Map<string, Set<IpcListener>>();

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

/**
 * 注册 IPC 监听器（改进版，支持精确清理）
 */
export const on = (
  channel: string,
  onSuccess: (data: any) => void,
  onFail?: (bizCode: string, message: string) => void
) => {
  // 创建监听器函数
  const listener = (event: Electron.IpcRendererEvent, args: ApiResponse<any>) => {
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
  };

  // 保存监听器引用
  if (!listenerMap.has(channel)) {
    listenerMap.set(channel, new Set());
  }
  listenerMap.get(channel)!.add(listener);

  // 注册监听器
  ipcRenderer.on(channel, listener);

  // 返回清理函数（可选使用）
  return () => {
    ipcRenderer.removeListener(channel, listener);
    const listeners = listenerMap.get(channel);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenerMap.delete(channel);
      }
    }
  };
};

export const onEvent = (
  channel: string,
  listener: (data: any) => void
) => {
  const wrappedListener = (event: Electron.IpcRendererEvent, args: ApiResponse<any>) => {
    console.log(`evemt => ${channel} , args => `, args);
    listener(args);
  };

  // 保存监听器引用
  if (!listenerMap.has(channel)) {
    listenerMap.set(channel, new Set());
  }
  listenerMap.get(channel)!.add(wrappedListener);

  ipcRenderer.on(`${channel}`, wrappedListener);

  // 返回清理函数
  return () => {
    ipcRenderer.removeListener(channel, wrappedListener);
    const listeners = listenerMap.get(channel);
    if (listeners) {
      listeners.delete(wrappedListener);
      if (listeners.size === 0) {
        listenerMap.delete(channel);
      }
    }
  };
};

/**
 * 移除指定频道的所有监听器
 */
export const removeRouterListeners = (channel: string) => {
  // 获取并清理所有已保存的监听器
  const listeners = listenerMap.get(channel);
  if (listeners) {
    listeners.forEach(listener => {
      ipcRenderer.removeListener(channel, listener);
    });
    listenerMap.delete(channel);
  }

  // 兜底：移除所有该频道的监听器（包括未在 Map 中追踪的）
  ipcRenderer.removeAllListeners(channel);
};

/**
 * 清理所有 IPC 监听器（用于组件销毁或页面卸载时）
 */
export const removeAllRouterListeners = () => {
  listenerMap.forEach((listeners, channel) => {
    listeners.forEach(listener => {
      ipcRenderer.removeListener(channel, listener);
    });
  });
  listenerMap.clear();
};

// 开发环境下，在模块热更新时自动清理
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HMR] Cleaning up IPC listeners...');
    removeAllRouterListeners();
  });
}
