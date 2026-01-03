import { BrowserWindow } from 'electron';
import { Container, inject, injectable } from 'inversify';
import { TYPES } from '../di';
import { EVENT_METADATA_KEY, EventMetadata } from './decorators';
import EventBus from './EventBus';
import log from "electron-log/main";

@injectable()
export default abstract class BaseEvent {
    @inject(TYPES.Container)
    protected readonly container: Container;

    constructor() {
        // Delaying registration slightly to ensure property injection is complete
        // or relying on subclasses to call it if they are not managed.
        // But if they are @injectable they should be managed.
        setTimeout(() => this.registerEventListeners(), 0);
    }

    protected send(channel: string, data: any) {
        const win = this.container.get<BrowserWindow>(TYPES.BrowserWindow);
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    }

    private registerEventListeners() {
        const events = (Reflect.getMetadata(EVENT_METADATA_KEY, this.constructor) as EventMetadata[]) || [];

        if (events.length > 0) {
            log.scope("event").info(`Registering ${events.length} event listeners for ${this.constructor.name}`);
        }

        events.forEach(event => {
            const handler = async (...args: any[]) => {
                const result = await (this as any)[event.method].apply(this, args);

                // If ipcChannel is specified, forward the result to renderer
                if (event.ipcChannel) {
                    this.send(event.ipcChannel, result);
                }
            };

            log.scope("event").info(`Binding internal event ${event.name} to ${this.constructor.name}.${event.method}${event.ipcChannel ? ' (IPC: ' + event.ipcChannel + ')' : ''}`);
            EventBus.on(event.name, handler);
        });
    }
}