interface ApiResponse<T> {
  bizCode: string;
  data: T;
  message: string;
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
