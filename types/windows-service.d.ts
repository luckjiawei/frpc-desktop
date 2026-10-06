type WindowsServiceAction = "install" | "start" | "stop" | "sync" | "uninstall";

interface WindowsServiceStatus {
  supported: boolean;
  installed: boolean;
  running: boolean;
  state: "notInstalled" | "running" | "stopped" | "pending";
  directory: string;
}
