import "reflect-metadata";
import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import SystemService from "electron/service/SystemService";
import { TYPES } from "../di";
import { Job } from "../core/decorators";
import { BrowserWindow } from "electron";
import { EventChannels } from "../core/constant";
import ResponseUtils from "../utils/ResponseUtils";

@injectable()
export default class MonitorEvent extends BaseEvent {

    @inject(TYPES.SystemService)
    private readonly _systemService: SystemService;

    constructor(@inject(TYPES.BrowserWindow) window: BrowserWindow) {
        super(window);
    }

    /**
     * 系统监控定时任务 - 每秒发送一次系统使用情况
     */
    @Job({ name: 'systemMonitor', interval: 1000, immediate: true })
    public async systemUsage() {
        const usage = await this._systemService.getSystemUsage();
        this.send(EventChannels.SYSTEM_MONITOR, ResponseUtils.success(usage));
    }

}