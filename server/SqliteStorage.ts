import Database from 'better-sqlite3';
import type { CrudInterface, Table, DataTypes, OmitId } from 'brackets-manager';
import type { Id } from 'brackets-model';

// ─── Columns stored as JSON strings in SQLite ─────────────────────────────────
const JSON_COLUMNS: Partial<Record<Table, string[]>> = {
  match:      ['opponent1', 'opponent2'],
  match_game: ['opponent1', 'opponent2'],
  stage:      ['settings'],
};

// ─── DDL ──────────────────────────────────────────────────────────────────────
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS participant (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    name          TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stage (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    type          TEXT    NOT NULL,
    number        INTEGER NOT NULL,
    settings      TEXT    NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS "group" (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id INTEGER NOT NULL,
    number   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS round (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    number   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS match (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id    INTEGER NOT NULL,
    group_id    INTEGER NOT NULL,
    round_id    INTEGER NOT NULL,
    number      INTEGER NOT NULL,
    child_count INTEGER NOT NULL DEFAULT 0,
    status      INTEGER NOT NULL DEFAULT 0,
    opponent1   TEXT,
    opponent2   TEXT
  );

  CREATE TABLE IF NOT EXISTS match_game (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    stage_id  INTEGER NOT NULL,
    parent_id INTEGER NOT NULL,
    number    INTEGER NOT NULL,
    status    INTEGER NOT NULL DEFAULT 0,
    opponent1 TEXT,
    opponent2 TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_participant_tournament ON participant(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_stage_tournament       ON stage(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_group_stage            ON "group"(stage_id);
  CREATE INDEX IF NOT EXISTS idx_round_stage            ON round(stage_id);
  CREATE INDEX IF NOT EXISTS idx_match_stage            ON match(stage_id);
  CREATE INDEX IF NOT EXISTS idx_match_round            ON match(round_id);
  CREATE INDEX IF NOT EXISTS idx_match_game_parent      ON match_game(parent_id);
  CREATE INDEX IF NOT EXISTS idx_match_game_stage       ON match_game(stage_id);
`;

export class SqliteStorage implements CrudInterface {
  private db: Database.Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    // WAL mode gives much better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** "group" is a SQL reserved word — quote it */
  private tbl(table: Table): string {
    return table === 'group' ? '"group"' : table;
  }

  /** Serialize JSON columns to strings before writing to SQLite */
  private serialize(table: Table, row: Record<string, unknown>): Record<string, unknown> {
    const cols = JSON_COLUMNS[table] ?? [];
    const out: Record<string, unknown> = { ...row };
    for (const col of cols) {
      if (col in out) {
        out[col] = out[col] === null ? null : JSON.stringify(out[col]);
      }
    }
    return out;
  }

  /** Deserialize JSON columns after reading from SQLite */
  private deserialize(table: Table, row: Record<string, unknown>): Record<string, unknown> {
    const cols = JSON_COLUMNS[table] ?? [];
    const out: Record<string, unknown> = { ...row };
    for (const col of cols) {
      if (col in out && typeof out[col] === 'string') {
        try {
          out[col] = JSON.parse(out[col] as string);
        } catch {
          // leave as-is if JSON parse fails
        }
      }
    }
    return out;
  }

  private buildWhere(filter: Record<string, unknown>): { clause: string; values: unknown[] } {
    const entries = Object.entries(filter).filter(([, v]) => v !== undefined);
    if (!entries.length) return { clause: '', values: [] };
    const clause = ' WHERE ' + entries.map(([k]) => `${k} = ?`).join(' AND ');
    const values = entries.map(([, v]) => v);
    return { clause, values };
  }

  // ── CrudInterface implementation ───────────────────────────────────────────

  async insert<T extends Table>(table: T, value: OmitId<DataTypes[T]>): Promise<number> {
    const row = this.serialize(table, value as Record<string, unknown>);
    const cols = Object.keys(row);
    const stmt = this.db.prepare(
      `INSERT INTO ${this.tbl(table)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
    );
    const result = stmt.run(...Object.values(row));
    return result.lastInsertRowid as number;
  }

  async select<T extends Table>(
    table: T,
    filter?: Partial<DataTypes[T]>
  ): Promise<DataTypes[T][] | null> {
    const { clause, values } = this.buildWhere((filter ?? {}) as Record<string, unknown>);
    const rows = this.db
      .prepare(`SELECT * FROM ${this.tbl(table)}${clause}`)
      .all(...values) as Record<string, unknown>[];

    const hasFilter = filter !== undefined && Object.keys(filter).length > 0;
    if (!rows.length) return hasFilter ? null : [];
    
    return rows.map((r) => this.deserialize(table, r)) as DataTypes[T][];
  }

  async selectFirst<T extends Table>(
    table: T,
    filter: Partial<DataTypes[T]>
  ): Promise<DataTypes[T] | null> {
    const { clause, values } = this.buildWhere(filter as Record<string, unknown>);
    const row = this.db
      .prepare(`SELECT * FROM ${this.tbl(table)}${clause} LIMIT 1`)
      .get(...values) as Record<string, unknown> | undefined;

    if (!row) return null;
    return this.deserialize(table, row) as DataTypes[T];
  }

  async selectAll<T extends Table>(table: T): Promise<DataTypes[T][]> {
    const rows = this.db
      .prepare(`SELECT * FROM ${this.tbl(table)}`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.deserialize(table, r)) as DataTypes[T][];
  }

  async update<T extends Table>(table: T, id: Id, value: DataTypes[T]): Promise<boolean> {
    const row = this.serialize(table, value as Record<string, unknown>);
    const cols = Object.keys(row).filter((k) => k !== 'id');
    if (!cols.length) return false;
    const stmt = this.db.prepare(
      `UPDATE ${this.tbl(table)} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`
    );
    const result = stmt.run(...cols.map((k) => row[k]), id);
    return result.changes > 0;
  }

  async delete<T extends Table>(table: T, filter?: Partial<DataTypes[T]>): Promise<boolean> {
    const { clause, values } = this.buildWhere((filter ?? {}) as Record<string, unknown>);
    const result = this.db
      .prepare(`DELETE FROM ${this.tbl(table)}${clause}`)
      .run(...values);
    return result.changes > 0;
  }
}
