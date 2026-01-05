interface IResponseCode {
  code: string;
  message: string;
}

interface ApiResponse<T> {
  code: string;
  data: T;
  message: string;
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

