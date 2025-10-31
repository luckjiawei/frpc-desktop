export enum LogLevel {
  ERROR = "error",
  INFO = "info",
  DEBUG = "debug",
  WARN = "warn"
}

export type LogRecord = {
  context: string;
  level: LogLevel;
  id: number;
};
