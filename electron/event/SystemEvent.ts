import { inject, injectable } from "inversify";
import BaseEvent from "../core/BaseEvent";
import SystemService from "electron/service/SystemService";
import { TYPES } from "../di";
import { Event } from "../core/decorators";

@injectable()
export default class SystemEvent extends BaseEvent {

    private readonly systemService: SystemService;

    constructor(@inject(TYPES.SystemService) systemService: SystemService) {
        super();
        this.systemService = systemService;
    }

    @Event('systemUsage')
    public systemUsage() {
        setInterval(() => {
            const result = this.systemService.getSystemUsage();
            this.send('systemUsage', result);
        }, 1000);
    }

}