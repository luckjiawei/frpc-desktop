import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import FrpcProcessService from "electron/service/FrpcProcessService";
import { TYPES } from "../di";
import { EventChannels } from "../core/constant";
import { Event } from "../core/decorators";

@injectable()
export default class FrpcProcessEvent extends BaseEvent {

    @inject(TYPES.FrpcProcessService)
    private readonly _frpcProcessService: FrpcProcessService;

    @Event(EventChannels.FRPC_PROCESS_STATUS, 1000)
    public async frpcProcessStatus() {
        const running = await this._frpcProcessService.isRunning();
        const lastStartTime = await this._frpcProcessService.getLastStartTime();
        return {
            running,
            lastStartTime
        }
    }
}