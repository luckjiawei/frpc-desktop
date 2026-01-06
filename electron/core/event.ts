
import { BrowserWindow } from 'electron';

import { TYPES } from '../di';
import { EVENT_METADATA_KEY, EventMetadata } from './decorators';
import EventBus from './event-bus';
import log from "electron-log/main";


import ResponseUtils from "../utils/ResponseUtils";

export default abstract class BaseEvent {
    protected readonly _window: BrowserWindow;

    constructor(window: BrowserWindow) {
        this._window = window;
        setTimeout(() => this.registerEventListeners(), 0);
    }

    protected send(channel: string, data: any) {
        if (this._window && !this._window.isDestroyed()) {
            log.scope("event").debug(`${channel} => ${JSON.stringify(data)}`);
            this._window.webContents.send(channel, data);
        }
    }

    private registerEventListeners() {
        const events = (Reflect.getMetadata(EVENT_METADATA_KEY, this.constructor) as EventMetadata[]) || [];

        if (events.length > 0) {
            log.scope("event").info(`Registering ${events.length} event listeners for ${this.constructor.name}`);
        }

        events.forEach(event => {
            const eventName = event.ipcChannel || event.method;
            const handler = async (...args: any[]) => {
                try {
                    const result = await (this as any)[event.method].apply(this, args);

                    // If ipcChannel is specified, forward the result to renderer
                    if (event.ipcChannel) {
                        this.send(event.ipcChannel, ResponseUtils.success(result));
                    }
                } catch (error) {
                    log.scope("event").error(`Error in event handler ${eventName}`, error);
                    if (event.ipcChannel) {
                        this.send(event.ipcChannel, ResponseUtils.fail(error));
                    }
                }
            };


            EventBus.on(eventName, handler);

            if (event.interval) {
                setInterval(handler, event.interval);
                log.scope("event").info(`  - [${event.interval}ms] ${event.ipcChannel} -> ${event.method}`);

            } else {
                log.scope("event").info(`  - ${event.ipcChannel} -> ${event.method}`);
            }
        });
    }
}