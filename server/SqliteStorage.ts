import Database from 'better-sqlite3';
import type { CrudInterface, Table, DataTypes, OmitId } from 'brackets-manager';
import type { Id } from 'brackets-model';

const JSON_COLUMNS: Partial<Record<Table, string[]>> = {
  match:      ['opponent1', 'opponent2'],
  match_game: ['opponent1', 'opponent2'],
  stage:      ['settings'],
};

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
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);

    // Bind all methods so 'this' is never lost when brackets-manager calls them
    this.insert     = this.insert.bind(this);
    this.select     = this.select.bind(this);
    this.selectFirst = this.selectFirst.bind(this);
    this.selectAll  = this.selectAll.bind(this);
    this.update     = this.update.bind(this);
    this.delete     = this.delete.bind(this);
  }

  private tbl(table: Table): string {
    return table === 'group' ? '"group"' : table;
  }

  private serialize(table: Table, row: Record<string, unknown>): Record<string, unknown> {
    const cols = JSON_COLUMNS[table] ?? [];
    const out: Record<string, unknown> = { ...row };
    for (const col of cols) {
      if (col in out) {
        out[col] = out[col] === null ? null : JSON.stringify(out[col]);
      }
    }
    // Coerce booleans to integers for SQLite
    for (const key of Object.keys(out)) {
      if (typeof out[key] === 'boolean') {
        out[key] = out[key] ? 1 : 0;
      }
    }
    return out;
  }

  private deserialize(table: Table, row: Record<string, unknown>): Record<string, unknown> {
    const cols = JSON_COLUMNS[table] ?? [];
    const out: Record<string, unknown> = { ...row };
    for (const col of cols) {
      if (col in out && typeof out[col] === 'string') {
        try {
          out[col] = JSON.parse(out[col] as string);
        } catch {
          // leave as-is
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

  async insert<T extends Table>(table: T, value: OmitId<DataTypes[T]>): Promise<number> {
    // brackets-manager sometimes passes an array of rows to insert at once
    if (Array.isArray(value)) {
      let lastId = 0;
      for (const item of value) {
        lastId = await this.insert(table, item);
      }
      return lastId;
    }

    const row = this.serialize(table, value as Record<string, unknown>);
    const cols = Object.keys(row);
    const sql = `INSERT INTO ${this.tbl(table)} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const vals = Object.values(row);

    console.log('[insert] table:', table);
    console.log('[insert] sql:', sql);
    console.log('[insert] values:', JSON.stringify(vals));

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...vals);
      return result.lastInsertRowid as number;
    } catch (e) {
      console.error('[insert] FAILED sql:', sql);
      console.error('[insert] FAILED values:', JSON.stringify(vals));
      console.error('[insert] FAILED error:', e);
      throw e;
    }
  }

  async select<T extends Table>(
    table: T,
    filter?: Partial<DataTypes[T]>
  ): Promise<DataTypes[T][] | null> {
    const { clause, values } = this.buildWhere((filter ?? {}) as Record<string, unknown>);
    const sql = `SELECT * FROM ${this.tbl(table)}${clause}`;

    console.log('[select] sql:', sql);
    console.log('[select] values:', JSON.stringify(values));

    try {
      const rows = this.db.prepare(sql).all(...values) as Record<string, unknown>[];
      const hasFilter = filter !== undefined && Object.keys(filter).length > 0;
      if (!rows.length) return hasFilter ? null : [];
      return rows.map((r) => this.deserialize(table, r)) as DataTypes[T][];
    } catch (e) {
      console.error('[select] FAILED sql:', sql);
      console.error('[select] FAILED error:', e);
      throw e;
    }
  }

  async selectFirst<T extends Table>(
    table: T,
    filter: Partial<DataTypes[T]>
  ): Promise<DataTypes[T] | null> {
    const { clause, values } = this.buildWhere(filter as Record<string, unknown>);
    const sql = `SELECT * FROM ${this.tbl(table)}${clause} LIMIT 1`;

    console.log('[selectFirst] sql:', sql);
    console.log('[selectFirst] values:', JSON.stringify(values));

    try {
      const row = this.db.prepare(sql).get(...values) as Record<string, unknown> | undefined;
      if (!row) return null;
      return this.deserialize(table, row) as DataTypes[T];
    } catch (e) {
      console.error('[selectFirst] FAILED sql:', sql);
      console.error('[selectFirst] FAILED error:', e);
      throw e;
    }
  }

  async selectAll<T extends Table>(table: T): Promise<DataTypes[T][]> {
    const sql = `SELECT * FROM ${this.tbl(table)}`;

    console.log('[selectAll] sql:', sql);

    try {
      const rows = this.db.prepare(sql).all() as Record<string, unknown>[];
      return rows.map((r) => this.deserialize(table, r)) as DataTypes[T][];
    } catch (e) {
      console.error('[selectAll] FAILED sql:', sql);
      console.error('[selectAll] FAILED error:', e);
      throw e;
    }
  }

async update<T extends Table>(table: T, id: Id, value: DataTypes[T]): Promise<boolean> {
  console.log('=== UPDATE 6 ===', table, id);

  // Log any call that involves match id 91
  const valueStr = JSON.stringify(value);
  if (table === 'match' && (
    JSON.stringify(id) === '91' || 
    valueStr.includes('"id":91')
  )) {
    console.log('!!! MATCH 91 UPDATE DETECTED !!!');
    console.log('!!! id:', JSON.stringify(id));
    console.log('!!! value:', valueStr.substring(0, 500));
  }


  console.log('[update] raw args - table:', table);
  console.log('[update] raw id:', JSON.stringify(id));
  console.log('[update] raw value:', JSON.stringify(value));
  console.log('[update] value keys:', Object.keys(value as object));
  console.log('[update] Array.isArray:', Array.isArray(value));

  const rawValue = value as Record<string, unknown>;
  const keys = Object.keys(rawValue);
  const isArrayLike = Array.isArray(value) ||
    (keys.length > 0 && keys.every(k => !isNaN(Number(k))));

  console.log('[update] isArrayLike:', isArrayLike);

if (isArrayLike) {
  const rows: Record<string, unknown>[] = Array.isArray(value)
    ? value as Record<string, unknown>[]
    : keys.map(k => rawValue[k] as Record<string, unknown>);

  console.log('[update] extracted rows count:', rows.length);

  const idIsScalar = id !== null && id !== undefined && 
    (typeof id === 'number' || typeof id === 'string');
    
  if (idIsScalar) {
    // Specific row targeted
    const target = rows.find((r) => r.id === id);
    if (target) return this.update(table, id, target as DataTypes[T]);
    return false;
  }

  // No specific id — update ALL rows since the manager modified
  // one of them in memory and we need to persist the whole set
  let changed = false;
  for (const row of rows) {
    const rowId = (row as Record<string, unknown>).id as Id;
    if (rowId !== null && rowId !== undefined) {
      const result = await this.update(table, rowId, row as DataTypes[T]);
      if (result) changed = true;
    }
  }
  return changed;
}

  // Case 2: id is a filter object — update rows matching the filter
  const idIsObject = id !== null && id !== undefined && typeof id === 'object';
  if (idIsObject) {
    const filter = id as Record<string, unknown>;
    const cleanFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== undefined)
    );

    const VALID_COLUMNS: Record<string, string[]> = {
      participant: ['id', 'tournament_id', 'name'],
      stage:       ['id', 'tournament_id', 'name', 'type', 'number', 'settings'],
      group:       ['id', 'stage_id', 'number'],
      round:       ['id', 'stage_id', 'group_id', 'number'],
      match:       ['id', 'stage_id', 'group_id', 'round_id', 'number', 'child_count', 'status', 'opponent1', 'opponent2'],
      match_game:  ['id', 'stage_id', 'parent_id', 'number', 'status', 'opponent1', 'opponent2'],
    };

    const validCols = VALID_COLUMNS[table] ?? [];
    const filtered: Record<string, unknown> = {};
    for (const key of validCols) {
      if (key in rawValue) filtered[key] = rawValue[key];
    }

    const row = this.serialize(table, filtered);
    const setCols = Object.keys(row).filter(k => k !== 'id');

    if (!setCols.length) {
      console.log('[update] filter update: no columns to set, skipping');
      return false;
    }

    let sql: string;
    let vals: unknown[];
    if (Object.keys(cleanFilter).length === 0) {
      sql = `UPDATE ${this.tbl(table)} SET ${setCols.map(k => `${k} = ?`).join(', ')}`;
      vals = setCols.map(k => row[k]);
    } else {
      const whereClauses = Object.keys(cleanFilter).map(k => `${k} = ?`);
      sql = `UPDATE ${this.tbl(table)} SET ${setCols.map(k => `${k} = ?`).join(', ')} WHERE ${whereClauses.join(' AND ')}`;
      vals = [...setCols.map(k => row[k]), ...Object.values(cleanFilter)];
    }

    console.log('[update] filter update sql:', sql);
    console.log('[update] filter update vals:', JSON.stringify(vals));

    try {
      const result = this.db.prepare(sql).run(...vals);
      return result.changes > 0;
    } catch (e) {
      console.error('[update] filter FAILED sql:', sql);
      console.error('[update] filter FAILED vals:', JSON.stringify(vals));
      console.error('[update] filter FAILED error:', e);
      throw e;
    }
  }

  // Case 3: Normal single-row update by scalar id
  const resolvedId: Id = (id !== null && id !== undefined)
    ? id
    : rawValue.id as Id;

  if (resolvedId === null || resolvedId === undefined) {
    console.error('[update] No id found in args or value object');
    return false;
  }

  const VALID_COLUMNS: Record<string, string[]> = {
    participant: ['id', 'tournament_id', 'name'],
    stage:       ['id', 'tournament_id', 'name', 'type', 'number', 'settings'],
    group:       ['id', 'stage_id', 'number'],
    round:       ['id', 'stage_id', 'group_id', 'number'],
    match:       ['id', 'stage_id', 'group_id', 'round_id', 'number', 'child_count', 'status', 'opponent1', 'opponent2'],
    match_game:  ['id', 'stage_id', 'parent_id', 'number', 'status', 'opponent1', 'opponent2'],
  };

  const validCols = VALID_COLUMNS[table] ?? [];
  const filteredRow: Record<string, unknown> = {};
  for (const key of validCols) {
    if (key in rawValue) filteredRow[key] = rawValue[key];
  }

  const row = this.serialize(table, filteredRow);
  const cols = Object.keys(row).filter((k) => k !== 'id');
  if (!cols.length) return false;

  const sql = `UPDATE ${this.tbl(table)} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  const vals = [...cols.map((k) => row[k]), resolvedId];

  console.log('[update] table:', table);
  console.log('[update] sql:', sql);
  console.log('[update] values:', JSON.stringify(vals));

  try {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...vals);
    return result.changes > 0;
  } catch (e) {
    console.error('[update] FAILED sql:', sql);
    console.error('[update] FAILED values:', JSON.stringify(vals));
    console.error('[update] FAILED error:', e);
    throw e;
  }
}

async delete<T extends Table>(table: T, filter?: Partial<DataTypes[T]>): Promise<boolean> {
    const { clause, values } = this.buildWhere((filter ?? {}) as Record<string, unknown>);
    const sql = `DELETE FROM ${this.tbl(table)}${clause}`;

    console.log('[delete] sql:', sql);
    console.log('[delete] values:', JSON.stringify(values));

    try {
      const result = this.db.prepare(sql).run(...values);
      return result.changes > 0;
    } catch (e) {
      console.error('[delete] FAILED sql:', sql);
      console.error('[delete] FAILED error:', e);
      throw e;
    }
  }
}