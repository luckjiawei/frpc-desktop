import "reflect-metadata";

import { ipcMain } from "electron";
import { IPC_METADATA_KEY, IpcRouteMetadata } from "./decorators";
import log from "electron-log/main";

/**
 * Abstract base class for all controllers in the application.
 */
export default abstract class BaseController {
  constructor() {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    const routes =
      (Reflect.getMetadata(
        IPC_METADATA_KEY,
        this.constructor
      ) as IpcRouteMetadata[]) || [];

    log.scope("ipc").info(`Registering ${routes.length} routes for ${this.constructor.name}`);

    routes.forEach((route: IpcRouteMetadata) => {
      const handler = (this as any)[route.method].bind(this);
      log.scope("ipc").info(`Binding ${route.ipcType} ${route.path} to ${route.method}`);

      if (route.ipcType === "on") {
        ipcMain.on(route.path, async (event: any, ...args: any[]) => {
          log.scope("ipc").info(`Received IPC on ${route.path} for ${this.constructor.name}.${route.method}`);
          try {
            const result = await handler(event, ...args);
            if (result !== undefined) {
              log.scope("ipc").info(`Replying to ${route.path}`);
              event.reply(`${route.path}:reply`, { data: result });
            }
          } catch (error) {
            log.scope("ipc").error(`Error in IPC handler ${route.path}`, error);
            event.reply(`${route.path}:error`, { error: error.message });
          }
        });
      } else if (route.ipcType === "handle") {
        ipcMain.handle(route.path, async (event: any, ...args: any[]) => {
          try {
            return await handler(event, ...args);
          } catch (error) {
            throw new Error(error.message);
          }
        });
      }
    });
  }
}
