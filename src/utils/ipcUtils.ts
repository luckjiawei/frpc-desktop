import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ElMessage } from "element-plus";

type HookHandler = (args: ApiResponse<any>) => void;
const hookHandlers = new Map<string, Set<HookHandler>>();

export const send = (router: IpcRouter, params?: any) => {
  const channel = `${router.path}:hook`;
  invoke<ApiResponse<any>>("ipc_send", {
    path: router.path,
    args: params
  })
    .then(args => {
      const handlers = hookHandlers.get(channel);
      if (handlers && handlers.size > 0) {
        handlers.forEach(fn => fn(args));
      }
    })
    .catch(err => {
      const message =
        typeof err === "string"
          ? err
          : err?.message || JSON.stringify(err) || "Internal error";
      const errResp: ApiResponse<any> = {
        bizCode: "A0001",
        data: null,
        message
      };
      const handlers = hookHandlers.get(channel);
      if (handlers && handlers.size > 0) {
        handlers.forEach(fn => fn(errResp));
      } else {
        ElMessage({
          message,
          type: "error"
        });
      }
    });
};

export const on = (
  router: IpcRouter,
  listerHandler: (data: any) => void,
  errHandler?: (bizCode: string, message: string) => void
) => {
  const channel = `${router.path}:hook`;
  const handler: HookHandler = (args: ApiResponse<any>) => {
    const { bizCode, data, message } = args;
    if (bizCode === "A1000") {
      listerHandler(data);
    } else {
      if (errHandler) {
        errHandler(bizCode, message);
      } else {
        ElMessage({
          message: message,
          type: "error"
        });
      }
    }
  };

  if (!hookHandlers.has(channel)) {
    hookHandlers.set(channel, new Set());
  }
  hookHandlers.get(channel)!.add(handler);

  let unlistenFn: UnlistenFn | null = null;
  let active = true;

  listen<ApiResponse<any>>(channel, event => {
    if (!active) return;
    handler(event.payload);
  }).then(unlisten => {
    if (!active) {
      unlisten();
    } else {
      unlistenFn = unlisten;
    }
  });

  return () => {
    active = false;
    if (unlistenFn) {
      unlistenFn();
    }
    const set = hookHandlers.get(channel);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        hookHandlers.delete(channel);
      }
    }
  };
};

export const onListener = (
  listener: Listener,
  listerHandler: (data: any) => void
) => {
  const channel = `${listener.channel}`;
  let unlistenFn: UnlistenFn | null = null;
  let active = true;

  listen<ApiResponse<any>>(channel, event => {
    if (!active) return;
    const { bizCode, data } = event.payload;
    if (bizCode === "A1000") {
      listerHandler(data);
    }
  }).then(unlisten => {
    if (!active) {
      unlisten();
    } else {
      unlistenFn = unlisten;
    }
  });

  return () => {
    active = false;
    if (unlistenFn) {
      unlistenFn();
    }
  };
};
