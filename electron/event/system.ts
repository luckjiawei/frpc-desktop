import "reflect-metadata";
import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import SystemService from "electron/service/system";
import { TYPES } from "../di";
import { Event } from "../core/decorators";
import { BrowserWindow } from "electron";
import { EventChannels } from "../core/constant";
import log from "electron-log/main";

@injectable()
export default class SystemEvent extends BaseEvent {

    @inject(TYPES.SystemService)
    private readonly _systemService: SystemService;

    constructor(@inject(TYPES.BrowserWindow) window: BrowserWindow) {
        super(window);
    }

    @Event(EventChannels.SYSTEM_MONITOR, 1000)
    public systemUsage() {
        return this._systemService.getSystemUsage();
    }

    @Event(EventChannels.SYSTEM_CHECK_INTERNET_CONNECT, 1000, false)
    public checkInternetConnect() {
        this._systemService.checkInternetConnect().then(r => {
            log.scope("event").info("checkInternetConnect", r)
        })
    }

}