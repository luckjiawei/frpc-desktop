type WindowsServiceAction = "install" | "start" | "stop" | "sync" | "uninstall";

interface WindowsServiceStatus {
  supported: boolean;
  installed: boolean;
  running: boolean;
  deploymentExists: boolean;
  lastStartTime: number;
  state: "notInstalled" | "running" | "stopped" | "pending" | "cleanupRequired";
  directory: string;
}
