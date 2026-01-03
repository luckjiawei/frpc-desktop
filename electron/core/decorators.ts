import 'reflect-metadata';
import log from "electron-log/main"

export const IPC_METADATA_KEY = 'ipc:routes';
export const EVENT_METADATA_KEY = 'event:listeners';

export interface IpcRouteMetadata {
  path: string;
  ipcType: string;
  method: string;
}

export interface EventMetadata {
  name: string;
  method: string;
  ipcChannel?: string;
}

export function IpcRoute(path: string, ipcType: string = 'on') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    log.scope("ipc").info("IpcRoute", path, ipcType);
    if (!Reflect.hasMetadata(IPC_METADATA_KEY, target.constructor)) {
      Reflect.defineMetadata(IPC_METADATA_KEY, [], target.constructor);
    }

    const routes = Reflect.getMetadata(IPC_METADATA_KEY, target.constructor) as IpcRouteMetadata[];
    routes.push({
      path,
      ipcType,
      method: propertyKey
    });

    Reflect.defineMetadata(IPC_METADATA_KEY, routes, target.constructor);
  };
}

export function Event(name: string, ipcChannel?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    log.scope("event").info("Event", name, ipcChannel);
    if (!Reflect.hasMetadata(EVENT_METADATA_KEY, target.constructor)) {
      Reflect.defineMetadata(EVENT_METADATA_KEY, [], target.constructor);
    }

    const events = Reflect.getMetadata(EVENT_METADATA_KEY, target.constructor) as EventMetadata[];
    events.push({
      name,
      method: propertyKey,
      ipcChannel
    });

    Reflect.defineMetadata(EVENT_METADATA_KEY, events, target.constructor);
  };
}