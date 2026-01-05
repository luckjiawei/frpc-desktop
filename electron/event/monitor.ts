import "reflect-metadata";
import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import SystemService from "electron/service/SystemService";
import { TYPES } from "../di";
import { Event } from "../core/decorators";
import { BrowserWindow } from "electron";
import { EventChannels } from "../core/constant";

@injectable()
export default class MonitorEvent extends BaseEvent {

    private readonly systemService: SystemService;
    private readonly window: BrowserWindow;

    constructor(@inject(TYPES.SystemService) systemService: SystemService, @inject(TYPES.BrowserWindow) window: BrowserWindow) {
        super(window);
        this.systemService = systemService;
    }

    @Event(EventChannels.SYSTEM_MONITOR, 1000)
    public systemUsage() {
        return this.systemService.getSystemUsage();
    }

}