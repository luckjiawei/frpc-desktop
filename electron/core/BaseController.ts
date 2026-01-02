import "reflect-metadata";

import { ipcMain } from "electron";
import { IPC_METADATA_KEY, IpcRouteMetadata } from "./decorators";

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

    routes.forEach((route: IpcRouteMetadata) => {
      const handler = (this as any)[route.method].bind(this);

      if (route.method === "on") {
        ipcMain.on(route.path, async (event: any, ...args: any[]) => {
          try {
            const result = await handler(event, ...args);
            if (result !== undefined) {
              event.reply(`${route.path}:reply`, { data: result });
            }
          } catch (error) {
            event.reply(`${route.path}:error`, { error: error.message });
          }
        });
      } else if (route.method === "handle") {
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
