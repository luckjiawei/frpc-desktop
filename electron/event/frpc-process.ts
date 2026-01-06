import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import FrpcProcessService from "electron/service/FrpcProcessService";
import { TYPES } from "../di";
import { EventChannels } from "../core/constant";
import { Event } from "../core/decorators";
import { BrowserWindow } from "electron";
import log from "electron-log/main";

@injectable()
export default class FrpcProcessEvent extends BaseEvent {

    @inject(TYPES.FrpcProcessService)
    private readonly _frpcProcessService: FrpcProcessService;

    constructor(
        @inject(TYPES.BrowserWindow) window: BrowserWindow
    ) {
        super(window);
    }

    @Event(EventChannels.FRPC_PROCESS_STATUS, 1000)
    public frpcProcessStatus() {
        const running = this._frpcProcessService.isRunning();
        const lastStartTime = this._frpcProcessService.getLastStartTime();
        const result = {
            running,
            lastStartTime
        };
        return result;
    }
}