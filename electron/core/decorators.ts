import 'reflect-metadata';

export const IPC_METADATA_KEY = 'ipc:routes';

export interface IpcRouteMetadata {
  path: string;
  method: string;
}

export function IpcRoute(path: string, method: string = 'on') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    if (!Reflect.hasMetadata(IPC_METADATA_KEY, target.constructor)) {
      Reflect.defineMetadata(IPC_METADATA_KEY, [], target.constructor);
    }
    
    const routes = Reflect.getMetadata(IPC_METADATA_KEY, target.constructor) as IpcRouteMetadata[];
    routes.push({
      path,
      method
    });
    
    Reflect.defineMetadata(IPC_METADATA_KEY, routes, target.constructor);
  };
}