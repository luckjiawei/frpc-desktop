interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

interface ControllerRequest {
  win: BrowserWindow;
  reply: string;
  event: Electron.IpcMainEvent;
  args: any[];
}
