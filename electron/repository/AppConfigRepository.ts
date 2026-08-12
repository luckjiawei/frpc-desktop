import Database from "better-sqlite3";
import IdUtils from "../utils/IdUtils";

interface AppConfigRow {
  config_key: string;
  config_value: string;
}

class AppConfigRepository {
  private static readonly DESKTOP_DEFAULTS: FrpcSystemConfiguration = {
    launchAtStartup: false,
    silentStartup: false,
    autoConnectOnStartup: false,
    notifyUpdates: true,
    language: "en-US"
  };

  constructor(private readonly database: Database.Database) {}

  public getSystemConfig(): FrpcSystemConfiguration {
    const rows = this.database
      .prepare(
        `SELECT config_key, config_value
         FROM t_frpcd_app_config
         WHERE scope_type = 'global'
           AND scope_id IS NULL
           AND namespace = 'desktop'
           AND deleted_at IS NULL`
      )
      .all() as AppConfigRow[];
    const values = new Map(rows.map(row => [row.config_key, row.config_value]));
    return {
      launchAtStartup: this.readBoolean(
        values.get("launch_at_startup"),
        AppConfigRepository.DESKTOP_DEFAULTS.launchAtStartup
      ),
      silentStartup: this.readBoolean(
        values.get("silent_startup"),
        AppConfigRepository.DESKTOP_DEFAULTS.silentStartup
      ),
      autoConnectOnStartup: this.readBoolean(
        values.get("auto_connect_on_startup"),
        AppConfigRepository.DESKTOP_DEFAULTS.autoConnectOnStartup
      ),
      notifyUpdates: this.readBoolean(
        values.get("notify_updates"),
        AppConfigRepository.DESKTOP_DEFAULTS.notifyUpdates
      ),
      language:
        values.get("language") || AppConfigRepository.DESKTOP_DEFAULTS.language
    };
  }

  public saveSystemConfig(system?: FrpcSystemConfiguration): void {
    const config = system || AppConfigRepository.DESKTOP_DEFAULTS;
    this.upsert(
      "desktop",
      "launch_at_startup",
      "boolean",
      String(config.launchAtStartup ?? false)
    );
    this.upsert(
      "desktop",
      "silent_startup",
      "boolean",
      String(config.silentStartup ?? false)
    );
    this.upsert(
      "desktop",
      "auto_connect_on_startup",
      "boolean",
      String(config.autoConnectOnStartup ?? false)
    );
    this.upsert(
      "desktop",
      "notify_updates",
      "boolean",
      String(config.notifyUpdates ?? true)
    );
    this.upsert("desktop", "language", "string", config.language || "en-US");
  }

  public hasNedbMigrationMarker(): boolean {
    const result = this.database
      .prepare(
        `SELECT EXISTS(
           SELECT 1
           FROM t_frpcd_app_config
           WHERE scope_type = 'global'
             AND scope_id IS NULL
             AND namespace = 'migration'
             AND config_key = 'nedb_v2_imported'
             AND config_value = 'true'
             AND deleted_at IS NULL
         ) AS found`
      )
      .get() as { found: number };
    return result.found === 1;
  }

  public saveNedbMigrationMarker(): void {
    this.upsert("migration", "nedb_v2_imported", "boolean", "true");
  }

  public deleteAll(): void {
    this.database.prepare("DELETE FROM t_frpcd_app_config").run();
  }

  private upsert(
    namespace: string,
    key: string,
    valueType: string,
    value: string
  ): void {
    const now = new Date().toISOString();
    const existing = this.database
      .prepare(
        `SELECT id
         FROM t_frpcd_app_config
         WHERE scope_type = 'global'
           AND scope_id IS NULL
           AND namespace = ?
           AND config_key = ?
           AND deleted_at IS NULL`
      )
      .get(namespace, key) as { id: string } | undefined;

    if (existing) {
      this.database
        .prepare(
          `UPDATE t_frpcd_app_config
           SET value_type = ?,
               config_value = ?,
               version = version + 1,
               updated_at = ?
           WHERE id = ?`
        )
        .run(valueType, value, now, existing.id);
      return;
    }

    this.database
      .prepare(
        `INSERT INTO t_frpcd_app_config (
           id, scope_type, scope_id, namespace, config_key,
           value_type, config_value, is_secret, encryption_type,
           version, created_at, updated_at, deleted_at
         ) VALUES (?, 'global', NULL, ?, ?, ?, ?, 0, NULL, 1, ?, ?, NULL)`
      )
      .run(IdUtils.genUUID(), namespace, key, valueType, value, now, now);
  }

  private readBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) {
      return fallback;
    }
    if (value !== "true" && value !== "false") {
      throw new Error("Invalid boolean value in desktop application config.");
    }
    return value === "true";
  }
}

export default AppConfigRepository;
