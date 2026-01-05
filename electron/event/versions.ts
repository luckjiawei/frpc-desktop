import "reflect-metadata";
import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import SystemService from "electron/service/SystemService";
import { TYPES } from "../di";
import { Event } from "../core/decorators";
import { BrowserWindow } from "electron";
import { EventChannels } from "../core/constant";
import VersionService from "electron/service/VersionService";

@injectable()
export default class VersionsEvent extends BaseEvent {

    @inject(TYPES.VersionService)
    private readonly _versionService: VersionService;

    @Event(EventChannels.VERSIONS_GET_VERSIONS)
    public async getVersions() {
        const versions = await this._versionService.getDownloadedVersions();
        this.send(EventChannels.VERSIONS_GET_VERSIONS, versions);
    }

}