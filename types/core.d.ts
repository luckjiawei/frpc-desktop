interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

interface ControllerParam {
  // win: BrowserWindow;
  channel: string;
  event: Electron.IpcMainEvent;
  args: any;
}

interface ListenerParam {
  // win: BrowserWindow;
  channel: string;
  args: any[];
}

type IpcRouter = {
  path: string;
  controller: string;
}

type Listener = {
  channel: string;
  listenerMethod: any;
};

enum IpcRouterKeys {
  SERVER = "SERVER",
  LOG = "LOG",
  VERSION = "VERSION",
  LAUNCH = "LAUNCH",
  PROXY = "PROXY",
  SYSTEM = "SYSTEM",
}

type IpcRouters = Record<
  IpcRouterKeys,
  {
    [method: string]: IpcRouter;
  }
>;

type Listeners = Record<string, Listener>;
