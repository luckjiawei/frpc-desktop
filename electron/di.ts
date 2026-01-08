
import "reflect-metadata";

export const TYPES = {
    /**
     * configuration
     */
    Container: Symbol.for("Container"),
    BrowserWindow: Symbol.for("BrowserWindow"),
    Knex: Symbol.for("Knex"),
    /**
     * converter
     */
    OpenSourceConfigConverter: Symbol.for("OpenSourceConfigConverter"),
    ProxiesConverter: Symbol.for("ProxiesConverter"),
    VersionConverter: Symbol.for("VersionConverter"),
    /** repository */
    OpenSourceConfigRepository: Symbol.for("OpenSourceConfigRepository"),
    VersionRepository: Symbol.for("VersionRepository"),
    ProxiesRepository: Symbol.for("ProxiesRepository"),
    /** service */
    SystemService: Symbol.for("SystemService"),
    OpenSourceFrpcDesktopConfigService: Symbol.for(
        "OpenSourceFrpcDesktopConfigService"
    ),
    GitHubService: Symbol.for("GitHubService"),
    VersionService: Symbol.for("VersionService"),
    LogService: Symbol.for("LogService"),
    FrpcProcessService: Symbol.for("FrpcProcessService"),
    ProxiesService: Symbol.for("ProxiesService"),

    /**
     * controller
     */
    SystemController: Symbol.for("SystemController"),
    VersionController: Symbol.for("VersionController"),
    LogController: Symbol.for("LogController"),
    LaunchController: Symbol.for("LaunchController"),
    ProxiesController: Symbol.for("ProxiesController"),
    FrpcDesktopApp: Symbol.for("FrpcDesktopApp"),
    ConfigController: Symbol.for("ConfigController"),
    /**
     * event
     */
    SystemEvent: Symbol.for("SystemEvent"),
    FrpcProcessEvent: Symbol.for("FrpcProcessEvent")
};
