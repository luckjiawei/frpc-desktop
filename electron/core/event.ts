
import { BrowserWindow } from 'electron';

import { TYPES } from '../di';
import { EVENT_METADATA_KEY, EventMetadata, JOB_METADATA_KEY, JobMetadata } from './decorators';
import EventBus from './event-bus';
import log from "electron-log/main";


import ResponseUtils from "../utils/ResponseUtils";

export default abstract class BaseEvent {
    protected readonly _window: BrowserWindow;
    private readonly _jobIntervals: NodeJS.Timeout[] = [];

    constructor(window: BrowserWindow) {
        this._window = window;
        setTimeout(() => {
            this.registerEventListeners();
            this.registerJobs();
        }, 0);
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

    /**
     * 注册所有 @Job 装饰器标记的定时任务
     */
    private registerJobs() {
        const jobs = (Reflect.getMetadata(JOB_METADATA_KEY, this.constructor) as JobMetadata[]) || [];

        if (jobs.length > 0) {
            log.scope("job").info(`Registering ${jobs.length} scheduled jobs for ${this.constructor.name}`);
        }

        jobs.forEach(job => {
            const { options } = job;

            if (!options.enabled) {
                log.scope("job").info(`  - [DISABLED] ${options.name}`);
                return;
            }

            const executeJob = async () => {
                try {
                    log.scope("job").debug(`Executing job: ${options.name}`);
                    await (this as any)[job.method].apply(this);
                } catch (error) {
                    log.scope("job").error(`Error in job ${options.name}:`, error);
                }
            };

            // 计算首次执行时间
            const startDelay = options.immediate ? 0 : options.initialDelay;

            // 设置定时任务
            setTimeout(() => {
                // 如果 immediate 为 true 且 initialDelay > 0，需要先等待 initialDelay
                if (options.immediate && options.initialDelay > 0) {
                    setTimeout(() => executeJob(), 0);
                } else if (options.immediate) {
                    executeJob();
                }

                // 设置周期性执行
                const intervalId = setInterval(executeJob, options.interval);
                this._jobIntervals.push(intervalId);
            }, options.immediate ? 0 : options.initialDelay);

            log.scope("job").info(
                `  - ${options.name}: interval=${options.interval}ms, ` +
                `initialDelay=${options.initialDelay}ms, immediate=${options.immediate}`
            );
        });
    }

    /**
     * 停止所有定时任务
     */
    protected stopAllJobs() {
        this._jobIntervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this._jobIntervals.length = 0;
        log.scope("job").info(`Stopped all jobs for ${this.constructor.name}`);
    }
}