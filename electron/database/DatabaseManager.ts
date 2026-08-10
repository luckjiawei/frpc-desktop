import Database from "better-sqlite3";
import { app } from "electron";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Logger from "../core/Logger";
import PathUtils from "../utils/PathUtils";

interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  sql: string;
}

interface AppliedMigration {
  version: number;
  name: string;
}

class DatabaseManager {
  private _database: Database.Database | null = null;

  constructor(
    private readonly databasePath = path.join(
      PathUtils.getDataBaseStoragePath(),
      "frpc-desktop.sqlite3"
    ),
    private readonly migrationsPath = DatabaseManager.getMigrationsPath()
  ) {}

  public initialize(): void {
    if (this._database) {
      return;
    }

    const database = new Database(this.databasePath);
    this._database = database;

    try {
      database.pragma("foreign_keys = ON");
      database.pragma("journal_mode = WAL");
      database.pragma("synchronous = NORMAL");
      database.pragma("busy_timeout = 5000");
      this.runMigrations(database);
      this.verifyDatabase(database);
    } catch (error) {
      database.close();
      this._database = null;
      throw error;
    }
  }

  public getDatabase(): Database.Database {
    if (!this._database) {
      throw new Error("SQLite database has not been initialized.");
    }
    return this._database;
  }

  public close(): void {
    if (!this._database) {
      return;
    }
    this._database.pragma("wal_checkpoint(TRUNCATE)");
    this._database.close();
    this._database = null;
    Logger.info(this.constructor.name, "SQLite database closed.");
  }

  public resetData(): void {
    const database = this.getDatabase();
    database.transaction(() => {
      database.prepare("DELETE FROM t_frpcd_proxies").run();
      database.prepare("DELETE FROM t_frpcd_servers").run();
      database.prepare("DELETE FROM t_frpcd_versions").run();
      database
        .prepare(
          "DELETE FROM t_frpcd_app_config WHERE namespace <> 'migration'"
        )
        .run();
    })();
  }

  private runMigrations(database: Database.Database): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS t_frpcd_schema_migrations (
        version INTEGER CONSTRAINT pk_t_frpcd_schema_migrations PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const migrations = this.loadMigrations();
    const applied = database
      .prepare(
        `SELECT version, name
         FROM t_frpcd_schema_migrations
         ORDER BY version`
      )
      .all() as AppliedMigration[];
    const filesByVersion = new Map(
      migrations.map(migration => [migration.version, migration])
    );

    applied.forEach((migration, index) => {
      const migrationFile = filesByVersion.get(migration.version);
      if (!migrationFile) {
        throw new Error(
          `Applied migration ${migration.version} is missing from the application.`
        );
      }
      if (migrations[index]?.version !== migration.version) {
        throw new Error(
          `SQLite migration history is not a valid prefix of the application migrations.`
        );
      }
      if (migrationFile.name !== migration.name) {
        throw new Error(
          `Applied migration ${migration.version} name does not match ${migrationFile.filename}.`
        );
      }
    });

    const appliedVersions = new Set(
      applied.map(migration => migration.version)
    );
    const insertMigration = database.prepare(`
      INSERT INTO t_frpcd_schema_migrations (version, name, applied_at)
      VALUES (?, ?, ?)
    `);

    migrations
      .filter(migration => !appliedVersions.has(migration.version))
      .forEach(migration => {
        database.transaction(() => {
          database.exec(migration.sql);
          insertMigration.run(
            migration.version,
            migration.name,
            new Date().toISOString()
          );
        })();
        Logger.info(
          this.constructor.name,
          `Applied SQLite migration ${migration.filename}.`
        );
      });
  }

  private loadMigrations(): MigrationFile[] {
    const sqlFiles = readdirSync(this.migrationsPath).filter(filename =>
      filename.endsWith(".sql")
    );
    if (sqlFiles.length === 0) {
      throw new Error(`No SQLite migrations found in ${this.migrationsPath}.`);
    }

    const versions = new Set<number>();
    return sqlFiles
      .map(filename => {
        const match = /^(\d+)_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/.exec(filename);
        if (!match) {
          throw new Error(
            `Invalid SQLite migration filename: ${filename}. Expected NNN_name.sql.`
          );
        }

        const version = Number.parseInt(match[1], 10);
        if (!Number.isSafeInteger(version) || version < 1) {
          throw new Error(`Invalid SQLite migration version in ${filename}.`);
        }
        if (versions.has(version)) {
          throw new Error(`Duplicate SQLite migration version: ${version}.`);
        }
        versions.add(version);

        return {
          version,
          name: match[2],
          filename,
          sql: readFileSync(path.join(this.migrationsPath, filename), "utf8")
        };
      })
      .sort((left, right) => left.version - right.version);
  }

  private verifyDatabase(database: Database.Database): void {
    const foreignKeysEnabled = database.pragma("foreign_keys", {
      simple: true
    }) as number;
    if (foreignKeysEnabled !== 1) {
      throw new Error("SQLite foreign key enforcement is not enabled.");
    }
    const foreignKeyErrors = database.pragma("foreign_key_check") as unknown[];
    if (foreignKeyErrors.length > 0) {
      throw new Error("SQLite foreign key check failed after migration.");
    }
    const integrityResult = database.pragma("integrity_check", {
      simple: true
    }) as string;
    if (integrityResult !== "ok") {
      throw new Error("SQLite integrity check failed after migration.");
    }
    Logger.info(this.constructor.name, "SQLite database initialized.");
  }

  private static getMigrationsPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "database", "migrations");
    }
    return path.join(app.getAppPath(), "electron", "database", "migrations");
  }
}

export default DatabaseManager;
