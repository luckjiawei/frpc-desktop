import Database from "better-sqlite3";
import IdUtils from "../utils/IdUtils";

export type SqlRow = Record<string, string | number | null>;

abstract class BaseRepository<T extends BaseEntity> {
  protected readonly database: Database.Database;
  private readonly tableName: string;
  private readonly insertStatement: Database.Statement;

  protected constructor(
    database: Database.Database,
    tableName: string,
    columns: string[]
  ) {
    this.database = database;
    this.tableName = tableName;
    const columnList = columns.join(", ");
    const values = columns.map(column => `@${column}`).join(", ");
    const updates = columns
      .filter(column => column !== "id")
      .map(column => `${column} = excluded.${column}`)
      .join(", ");
    this.insertStatement = database.prepare(`
      INSERT INTO ${tableName} (${columnList})
      VALUES (${values})
      ON CONFLICT(id) DO UPDATE SET ${updates}
    `);
  }

  protected abstract toRow(entity: T): SqlRow;

  protected abstract fromRow(row: SqlRow): T;

  protected genId(): string {
    return IdUtils.genUUID();
  }

  async insert(entity: T): Promise<T> {
    entity._id = this.genId();
    this.upsertForMigration(entity);
    return entity;
  }

  async insertMany(entities: T[]): Promise<T[]> {
    this.database.transaction(() => {
      entities.forEach(entity => {
        entity._id = this.genId();
        this.upsertForMigration(entity);
      });
    })();
    return entities;
  }

  async updateById(id: string, entity: T): Promise<T> {
    entity._id = id;
    this.upsertForMigration(entity);
    return entity;
  }

  async deleteById(id: string): Promise<void> {
    this.database.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }

  async findById(id: string): Promise<T> {
    const row = this.database
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(id) as SqlRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  async findAll(): Promise<T[]> {
    const rows = this.database
      .prepare(`SELECT * FROM ${this.tableName}`)
      .all() as SqlRow[];
    return rows.map(row => this.fromRow(row));
  }

  async truncate(): Promise<void> {
    this.database.prepare(`DELETE FROM ${this.tableName}`).run();
  }

  public upsertForMigration(entity: T): void {
    if (!entity._id) {
      entity._id = this.genId();
    }
    this.insertStatement.run(this.toRow(entity));
  }
}

export default BaseRepository;
