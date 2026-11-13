export enum LogLevel {
  ERROR = "error",
  INFO = "info",
  DEBUG = "debug",
  WARN = "warn"
}

export type LogFormat = "app" | "frpc" | "cloudflared";

export type LogRecord = {
  /** Stable key for rendering, unique inside one parsed log content. */
  id: string;
  /** Original line, kept for copying/searching without losing information. */
  context: string;
  level: LogLevel;
  /** Timestamp extracted from the line, empty when the format is unknown. */
  timestamp: string;
  /** Optional source segment such as `service.go:123` in frpc logs. */
  source: string;
  /** Remaining text after timestamp/level/source, used for display. */
  message: string;
};

/** `2024-05-01 12:34:56.789 [I] [service.go:123] message` */
const FRPC_LINE_PATTERN =
  /^(\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?)\s+\[([IWEDT])\]\s*(?:\[([^\]]+)\]\s*)?([\s\S]*)$/;

/** `[2024-05-01 12:34:56.789] [info] message` */
const APP_LINE_PATTERN =
  /^\[?(\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?)\]?\s+(?:\[?(info|warn|warning|error|debug|trace|err)\]?\s+)?([\s\S]*)$/i;

/** `2024-05-01T12:34:56Z INF message` */
const CLOUDFLARED_LINE_PATTERN =
  /^(\d{4}[-/]\d{2}[-/]\d{2}T\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?Z?)\s+(ERR|WRN|INF|DBG|FTL|CRIT)\s+([\s\S]*)$/;

const LEVEL_BY_TOKEN: Record<string, LogLevel> = {
  i: LogLevel.INFO,
  info: LogLevel.INFO,
  inf: LogLevel.INFO,
  w: LogLevel.WARN,
  warn: LogLevel.WARN,
  warning: LogLevel.WARN,
  wrn: LogLevel.WARN,
  e: LogLevel.ERROR,
  error: LogLevel.ERROR,
  err: LogLevel.ERROR,
  ftl: LogLevel.ERROR,
  crit: LogLevel.ERROR,
  d: LogLevel.DEBUG,
  debug: LogLevel.DEBUG,
  t: LogLevel.DEBUG,
  trace: LogLevel.DEBUG,
  dbg: LogLevel.DEBUG
};

const LEVEL_MARKER_PATTERN =
  /\[(error|warn|warning|info|debug|trace|err|[IWEDT])\]/i;

const detectLevel = (token: string | undefined, raw: string): LogLevel => {
  if (token) {
    const level = LEVEL_BY_TOKEN[token.toLowerCase()];
    if (level) return level;
  }

  const marker = raw.match(LEVEL_MARKER_PATTERN);
  if (marker) {
    const level = LEVEL_BY_TOKEN[marker[1].toLowerCase()];
    if (level) return level;
  }

  return LogLevel.INFO;
};

export const parseLogLine = (
  rawLine: string,
  format: LogFormat,
  id: string
): LogRecord => {
  const context = rawLine.replace(/\r$/, "");
  const match =
    format === "frpc"
      ? context.match(FRPC_LINE_PATTERN)
      : format === "cloudflared"
        ? context.match(CLOUDFLARED_LINE_PATTERN)
        : context.match(APP_LINE_PATTERN);

  if (match) {
    if (format === "frpc") {
      const [, timestamp, token, source, message] = match;
      return {
        id,
        context,
        timestamp,
        source: source ?? "",
        message: message || context,
        level: detectLevel(token, context)
      };
    }

    if (format === "cloudflared") {
      const [, timestamp, token, message] = match;
      return {
        id,
        context,
        timestamp,
        source: "",
        message: message || context,
        level: detectLevel(token, context)
      };
    }

    const [, timestamp, token, message] = match;
    return {
      id,
      context,
      timestamp,
      source: "",
      message: message || context,
      level: detectLevel(token, context)
    };
  }

  return {
    id,
    context,
    timestamp: "",
    source: "",
    message: context,
    level: detectLevel(undefined, context)
  };
};

/**
 * Parse a whole log file content. The newest line comes first to keep the
 * "latest on top" behaviour of the log view.
 */
export const parseLogContent = (
  content: string,
  format: LogFormat
): Array<LogRecord> => {
  return content
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map((line, index) => parseLogLine(line, format, `line-${index}`))
    .reverse();
};

/** 应用日志：`[time] [level] message` */
export const parseAppLog = (data: string) => parseLogContent(data, "app");

/** frpc 日志：`[time] [I] [source] message` */
export const parseFrpcLog = (data: string) => parseLogContent(data, "frpc");

/** cloudflared 日志：`<time> ERR|WRN|INF|DBG <message>` */
export const parseCloudflaredLog = (data: string) =>
  parseLogContent(data, "cloudflared");
