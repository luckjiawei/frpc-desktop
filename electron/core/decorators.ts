import 'reflect-metadata';
import log, { scope } from "electron-log/main"
import ResponseUtils from "../utils/ResponseUtils";

export const IPC_METADATA_KEY = 'ipc:routes';
export const EVENT_METADATA_KEY = 'event:listeners';
export const JOB_METADATA_KEY = 'job:schedules';

export interface IpcRouteMetadata {
  path: string;
  ipcType: string;
  method: string;
  manualReply?: boolean;
}

export interface IpcRouteOptions {
  manualReply?: boolean;
}

export interface EventMetadata {
  method: string;
  ipcChannel?: string;
  interval?: number;
}

/**
 * Job 装饰器配置选项
 */
export interface JobOptions {
  /** 任务名称，用于日志和管理 */
  name?: string;
  /** 执行间隔时间（毫秒） */
  interval: number;
  /** 首次执行前的延迟时间（毫秒），默认为 0 */
  initialDelay?: number;
  /** 是否在启动时立即执行一次，默认为 false */
  immediate?: boolean;
  /** 是否启用，默认为 true */
  enabled?: boolean;
}

export interface JobMetadata {
  method: string;
  options: Required<JobOptions>;
}
/**
 *  
 * @param path 
 * @param ipcType 
 * @param options
 * @returns 
 */
export function IpcRoute(path: string, ipcType: string = 'on', options?: IpcRouteOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // if (options) {
    //   log.scope("ipc").info(`${path} => ${propertyKey} options: ${options}`);
    // } else {
    //   log.scope("ipc").info(`${path} => ${propertyKey}`);
    // }
    if (!Reflect.hasMetadata(IPC_METADATA_KEY, target.constructor)) {
      Reflect.defineMetadata(IPC_METADATA_KEY, [], target.constructor);
    }

    const routes = Reflect.getMetadata(IPC_METADATA_KEY, target.constructor) as IpcRouteMetadata[];
    routes.push({
      path,
      ipcType,
      method: propertyKey,
      manualReply: options?.manualReply
    });

    Reflect.defineMetadata(IPC_METADATA_KEY, routes, target.constructor);
  };
}

export function Event(ipcChannel?: string, interval?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    log.scope("event").info("Event", ipcChannel, interval);
    if (!Reflect.hasMetadata(EVENT_METADATA_KEY, target.constructor)) {
      Reflect.defineMetadata(EVENT_METADATA_KEY, [], target.constructor);
    }

    const events = Reflect.getMetadata(EVENT_METADATA_KEY, target.constructor) as EventMetadata[];
    events.push({
      method: propertyKey,
      ipcChannel,
      interval
    });

    Reflect.defineMetadata(EVENT_METADATA_KEY, events, target.constructor);
  };
}

/**
 * Job 装饰器 - 用于标记定时任务方法
 * @param options 定时任务配置选项
 * @example
 * ```typescript
 * @Job({ name: 'heartbeat', interval: 5000, immediate: true })
 * async sendHeartbeat() {
 *   // 每5秒执行一次心跳
 * }
 * 
 * @Job({ interval: 60000, initialDelay: 10000 })
 * async syncData() {
 *   // 启动10秒后开始，每分钟同步一次数据
 * }
 * ```
 */
export function Job(options: JobOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // 设置默认值
    const normalizedOptions: Required<JobOptions> = {
      name: options.name || propertyKey,
      interval: options.interval,
      initialDelay: options.initialDelay ?? 0,
      immediate: options.immediate ?? false,
      enabled: options.enabled ?? true
    };

    log.scope("job").info(`Registering job: ${normalizedOptions.name} (interval: ${normalizedOptions.interval}ms)`);

    if (!Reflect.hasMetadata(JOB_METADATA_KEY, target.constructor)) {
      Reflect.defineMetadata(JOB_METADATA_KEY, [], target.constructor);
    }

    const jobs = Reflect.getMetadata(JOB_METADATA_KEY, target.constructor) as JobMetadata[];
    jobs.push({
      method: propertyKey,
      options: normalizedOptions
    });

    Reflect.defineMetadata(JOB_METADATA_KEY, jobs, target.constructor);
  };
}