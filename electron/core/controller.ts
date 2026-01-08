import "reflect-metadata";

import { ipcMain } from "electron";
import { IPC_METADATA_KEY, IpcRouteMetadata } from "./decorators";
import log from "electron-log/main";
import ResponseUtils from "../utils/ResponseUtils";
import { el } from "element-plus/es/locale/index.mjs";

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

    if (routes.length > 0) {
      log
        .scope("ipc")
        .info(
          `Registering ${routes.length} routes for ${this.constructor.name}`
        );

      routes.forEach(route => {
        log
          .scope("ipc")
          .info(`  - [${route.ipcType}] ${route.path} -> ${route.method}`);
      });
    }

    routes.forEach((route: IpcRouteMetadata) => {
      const handler = (this as any)[route.method].bind(this);
      const scope = log.scope("ipc");

      if (route.ipcType === "on") {
        ipcMain.on(route.path, async (event: any, ...args: any[]) => {
          if (args) {
            scope.debug(
              `[Request] ${route.path} -> ${this.constructor.name}.${route.method} params => ${JSON.stringify(args)}`
            );
          } else {
            scope.debug(
              `[Request] ${route.path} -> ${this.constructor.name}.${route.method}`
            );
          }
          try {
            const result = await handler(event, ...args);
            if (!route.manualReply) {
              scope.debug(
                `[Response] ${route.path} result => ${JSON.stringify(result)}`
              );
              event.reply(route.path, ResponseUtils.success(result));
            }
          } catch (error) {
            scope.error(`[Error] ${route.path}`, error);
            event.reply(route.path, ResponseUtils.fail(error));
          }
        });
      } else if (route.ipcType === "handle") {
        ipcMain.handle(route.path, async (event: any, ...args: any[]) => {
          scope.info(
            `[Invoke] ${route.path} -> ${this.constructor.name}.${route.method}`,
            args
          );
          try {
            const result = await handler(event, ...args);
            scope.info(
              `[Response] ${route.path} result => ${JSON.stringify(result)}`
            );
            return ResponseUtils.success(result);
          } catch (error) {
            scope.error(`[Error] ${route.path}`, error);
            return ResponseUtils.fail(error);
          }
        });
      }
    });
  }
}
