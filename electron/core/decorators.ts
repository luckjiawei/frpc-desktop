import 'reflect-metadata';
import log, { scope } from "electron-log/main"
import ResponseUtils from "../utils/ResponseUtils";

export const IPC_METADATA_KEY = 'ipc:routes';
export const EVENT_METADATA_KEY = 'event:listeners';

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
 *  
 * @param path 
 * @param ipcType 
 * @param options
 * @returns 
 */
export function IpcRoute(path: string, ipcType: string = 'on', options?: IpcRouteOptions) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    log.scope("ipc").info("IpcRoute", path, ipcType);
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