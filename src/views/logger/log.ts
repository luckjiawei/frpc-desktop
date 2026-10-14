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

const toRecords = (
  data: string,
  markers: Array<[string, LogLevel]>
): Array<LogRecord> =>
  data
    .split("\n")
    .map((line, index) => ({
      id: index,
      context: line,
      level: markers.find(([m]) => line.includes(m))?.[1] ?? LogLevel.INFO
    }))
    .reverse();

/** frpc 日志：[E] / [W] / [I] / [D] */
export const parseFrpcLog = (data: string) =>
  toRecords(data, [
    ["[E]", LogLevel.ERROR],
    ["[W]", LogLevel.WARN],
    ["[I]", LogLevel.INFO],
    ["[D]", LogLevel.DEBUG]
  ]);

/** 应用日志：[error] / [warn] / [info] / [debug] */
export const parseAppLog = (data: string) =>
  toRecords(data, [
    ["[error]", LogLevel.ERROR],
    ["[warn]", LogLevel.WARN],
    ["[info]", LogLevel.INFO],
    ["[debug]", LogLevel.DEBUG]
  ]);
