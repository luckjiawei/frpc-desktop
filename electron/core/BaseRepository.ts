import knex from "knex";
import BeanFactory from "../core/BeanFactory";

export default abstract class BaseRepository<T extends BaseModel> {
  protected readonly db: knex.Knex;

  protected constructor() {
    this.db = BeanFactory.getBean<knex.Knex>("db");
    this.initTableSchema();
  }

  /**
   * Initialize the table schema
   * @protected
   */
  protected abstract initTableSchema(): void;

  /**
   * Define the table name
   * @protected
   */
  protected abstract tableName(): string;

  /**
   * Generate a unique ID
   * @returns A unique UUID string
   */
  // protected genId(): string {
  //   return IdUtils.genUUID();
  // }

  /**
   * Get database table reference
   * @returns Database table query builder
   */
  public table() {
    return this.db.table(this.tableName());
  }

  /**
   * Insert a single record into the database
   * @param t - The record to insert
   * @returns Promise resolving to the insert result
   */
  async insert(t: T) {
    return this.table().insert(t);
  }

  /**
   * Insert multiple records into the database
   * @param t - Array of records to insert
   * @returns Promise resolving to the insert result
   */
  async insertMany(t: Array<T>) {
    return this.table().insert(t);
  }

  /**
   * Select all records from the table
   * @returns Promise resolving to all records
   */
  async selectAll() {
    return this.table().select("*");
  }

  /**
   * Select a record by its ID
   * @param id - The ID of the record to find
   * @returns Promise resolving to the found record or null
   */
  async selectById(id: number): Promise<T> {
    return this.table().select("*").where("id", "=", id).first();
  }

  /**
   * Delete a record by its ID
   * @param id - The ID of the record to delete
   * @returns Promise resolving to the delete result
   */
  async deleteById(id: number) {
    return this.table().where("id", "=", id).delete();
  }

  /**
   * Update a record by its ID
   * @param t - The record with updated values (must include ID)
   * @returns Promise resolving to the update result
   */
  async updateById(t: T) {
    if (!(t && t.id)) {
      return;
    }
    return this.table().where("id", "=", t.id).update(t);
  }

  /**
   * Check if a record with the specified ID exists in the database
   * @param id - The ID of the record to check
   * @returns Promise resolving to true if the record exists, false otherwise
   */
  async exists(id: number): Promise<boolean> {
    // return this.table().select().where("id", "=", id).first() !== undefined;
    return new Promise((fn1, fn2) => {
      this.table()
        .select()
        .where("id", "=", id)
        .first()
        .then(r => {
          fn1(r !== undefined);
        })
        .catch(e => {
          fn2(e);
        });
    });
  }
}

