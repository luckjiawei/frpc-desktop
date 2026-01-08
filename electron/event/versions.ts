import "reflect-metadata";
import { inject, injectable } from "inversify";
import BaseEvent from "../core/event";
import SystemService from "electron/service/system";
import { TYPES } from "../di";
import { Event } from "../core/decorators";
import { BrowserWindow } from "electron";
import { EventChannels } from "../core/constant";
import VersionService from "electron/service/versions";

@injectable()
export default class VersionsEvent extends BaseEvent {
  @inject(TYPES.VersionService)
  private readonly _versionService: VersionService;
}
