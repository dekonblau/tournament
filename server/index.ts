import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { BracketsManager } from 'brackets-manager';
import { SqliteStorage } from './SqliteStorage.js';
import morgan from 'morgan';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = process.env.DB_PATH ?? './brackets.db';

app.use(morgan('dev'));
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ─── Init manager ─────────────────────────────────────────────────────────────
const storage = new SqliteStorage(DB_PATH);
const manager = new BracketsManager(storage);

console.log(`[server] SQLite database: ${DB_PATH}`);

// ─── Export cache (invalidated on any write) ──────────────────────────────────
let exportCache: { data: unknown; ts: number } | null = null;
const EXPORT_TTL_MS = 500;
app.use((_req, _res, next) => { if (_req.method !== 'GET') exportCache = null; next(); });

// ─── Error handler helper ─────────────────────────────────────────────────────
function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[server] Error:', msg);
      res.status(400).json({ error: msg });
    }
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TOURNAMENTS (server-persisted, not localStorage)
// ═════════════════════════════════════════════════════════════════════════════
const db = (storage as unknown as { db: import('better-sqlite3').Database }).db;

app.get('/api/tournaments', wrap(async (_req, res) => {
  res.json(db.prepare('SELECT * FROM tournament ORDER BY id ASC').all());
}));

app.get('/api/tournament/:id/stages', wrap(async (req, res) => {
  res.json(db.prepare('SELECT * FROM stage WHERE tournament_id = ? ORDER BY id ASC').all(Number(req.params.id)));
}));

// Returns participants seeded into a specific stage, in slot order.
// (Replaces the tournament-scoped /participants endpoint which was too broad —
//  a tournament can have multiple stages with different participant sets.)
// Slots with no participant (TBD) are included with name: null so the caller
// can see the full seeding layout and identify open positions by slot_index.
app.get('/api/stage/:id/participants', wrap(async (req, res) => {
  const stageId = Number(req.params.id);
  const slots = await manager.get.seeding(stageId);
  const result = slots.map((slot, index) => {
    if (!slot || (slot as { id: number | null }).id === null) {
      return { slot_index: index, id: null, name: null };
    }
    const p = db.prepare('SELECT * FROM participant WHERE id = ?').get((slot as { id: number }).id) as { id: number; name: string } | undefined;
    return { slot_index: index, id: p?.id ?? null, name: p?.name ?? null };
  });
  res.json(result);
}));

app.post('/api/tournament', wrap(async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const result = db.prepare("INSERT INTO tournament (name) VALUES (?)").run(name.trim());
  const row = db.prepare('SELECT * FROM tournament WHERE id = ?').get(result.lastInsertRowid);
  res.json(row);
}));

// ═════════════════════════════════════════════════════════════════════════════
// GET  /api/export          — full database export (used to seed the viewer)
// ═════════════════════════════════════════════════════════════════════════════
app.get('/api/export', wrap(async (_req, res) => {
  const now = Date.now();
  if (exportCache && now - exportCache.ts < EXPORT_TTL_MS) {
    return res.json(exportCache.data);
  }
  const data = await manager.export() as Record<string, unknown>;
  data.tournament = db.prepare('SELECT * FROM tournament ORDER BY id ASC').all();
  exportCache = { data, ts: now };
  res.json(data);
}));

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/import          — import a full database snapshot
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/import', wrap(async (req, res) => {
  const { data, normalizeIds = false } = req.body as { data: Record<string, unknown>; normalizeIds?: boolean };
  await manager.import(data as never, normalizeIds);
  // Restore tournaments if included in the export payload
  if (Array.isArray(data.tournament) && data.tournament.length > 0) {
    db.prepare('DELETE FROM tournament').run();
    const insert = db.prepare('INSERT INTO tournament (id, name, created_at) VALUES (?, ?, ?)');
    for (const t of data.tournament as Array<{ id: number; name: string; created_at: string }>) {
      insert.run(t.id, t.name, t.created_at);
    }
  }
  res.json({ ok: true });
}));

// ═════════════════════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/participant', wrap(async (req, res) => {
  const { tournamentId, names } = req.body as { tournamentId: number; names: string[] };
  if (!tournamentId || !Array.isArray(names) || names.length === 0) {
    res.status(400).json({ error: 'tournamentId and names[] are required' }); return;
  }
  const insert = db.prepare('INSERT INTO participant (tournament_id, name) VALUES (?, ?)');
  const ids: number[] = [];
  db.transaction(() => {
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const r = insert.run(tournamentId, trimmed);
      ids.push(Number(r.lastInsertRowid));
    }
  })();
  exportCache = null;
  res.json({ ok: true, ids });
}));

app.patch('/api/participant/:id', wrap(async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  db.prepare('UPDATE participant SET name = ? WHERE id = ?').run(name.trim(), Number(req.params.id));
  exportCache = null;
  res.json({ ok: true });
}));

app.delete('/api/participant/:id', wrap(async (req, res) => {
  const pid = Number(req.params.id);
  const used = db.prepare(
    `SELECT COUNT(*) AS n FROM match
     WHERE json_extract(opponent1, '$.id') = ? OR json_extract(opponent2, '$.id') = ?`
  ).get(pid, pid) as { n: number };
  if (used.n > 0) {
    res.status(400).json({ error: 'Participant is assigned to one or more matches and cannot be removed.' }); return;
  }
  db.prepare('DELETE FROM participant WHERE id = ?').run(pid);
  exportCache = null;
  res.json({ ok: true });
}));

// ═════════════════════════════════════════════════════════════════════════════
// CREATE
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/stage', wrap(async (req, res) => {
  const stage = await manager.create.stage(req.body);
  res.json(stage);
}));

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE
// ═════════════════════════════════════════════════════════════════════════════
app.patch('/api/match', wrap(async (req, res) => {
  console.log('[route] PATCH /api/match body:', JSON.stringify(req.body));

  const { id, opponent1, opponent2, status } = req.body;

  // Determine upfront whether this match has a BYE/TBD opponent.
  // Only BYE matches use the direct-write fallback — real matches must let
  // errors propagate so bracket advancement failures aren't silently swallowed.
  const existingMatch = id !== undefined
    ? await storage.selectFirst('match', { id }) as Record<string, unknown> | null
    : null;
  const matchHasBye = !!(existingMatch && (
    existingMatch.opponent1 === null ||
    existingMatch.opponent2 === null ||
    (existingMatch.opponent1 as Record<string, unknown> | null)?.id === null ||
    (existingMatch.opponent2 as Record<string, unknown> | null)?.id === null
  ));

  let managerSucceeded = false;
  try {
    await manager.update.match(req.body);
    managerSucceeded = true;
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    if (!matchHasBye) throw e; // real match — propagate so the client sees the failure
    console.warn('[route] BYE match update falling back to direct writes:', msg);
  }

  // Direct-write fallback: persist scores when manager couldn't run (null opponent / BYE slot).
  // This does NOT advance brackets — that only happens when manager succeeds above.
  if (!managerSucceeded && id !== undefined && (opponent1?.score !== undefined || opponent2?.score !== undefined)) {
    const existingGames = await storage.select('match_game', { parent_id: id });
    console.log('[route] fallback: existing match_games:', JSON.stringify(existingGames));

    if (existingGames && existingGames.length > 0) {
      for (const existingGame of existingGames) {
        const gameRecord = existingGame as Record<string, unknown>;
        const updatedGame = {
          ...gameRecord,
          status: status ?? gameRecord.status,
          opponent1: opponent1
            ? { ...(gameRecord.opponent1 as object ?? {}), ...opponent1 }
            : gameRecord.opponent1,
          opponent2: opponent2
            ? { ...(gameRecord.opponent2 as object ?? {}), ...opponent2 }
            : gameRecord.opponent2,
        };
        console.log('[route] fallback: updating match_game:', JSON.stringify(updatedGame));
        await storage.update('match_game', gameRecord.id as number, updatedGame as never);
      }
    }

    const existingMatch = await storage.selectFirst('match', { id });
    if (existingMatch) {
      const matchRecord = existingMatch as Record<string, unknown>;
      const score1 = opponent1?.score ?? (matchRecord.opponent1 as Record<string, unknown>)?.score;
      const score2 = opponent2?.score ?? (matchRecord.opponent2 as Record<string, unknown>)?.score;
      const winner = score1 > score2 ? 'opponent1' : score2 > score1 ? 'opponent2' : null;

      const updatedMatch = {
        ...matchRecord,
        status: status ?? matchRecord.status,
        opponent1: {
          ...(matchRecord.opponent1 as object ?? {}),
          ...opponent1,
          result: winner === 'opponent1' ? 'win' : winner ? 'loss' : undefined,
        },
        opponent2: {
          ...(matchRecord.opponent2 as object ?? {}),
          ...opponent2,
          result: winner === 'opponent2' ? 'win' : winner ? 'loss' : undefined,
        },
      };
      console.log('[route] fallback: updating match directly:', JSON.stringify(updatedMatch));
      await storage.update('match', id, updatedMatch as never);
    }
  }

  // For child_count > 0 matches, sync scores/results to each match_game record.
  // manager.update.match only writes status/result to games, not raw scores.
  if (managerSucceeded && id !== undefined) {
    const parentRec = await storage.selectFirst('match', { id }) as Record<string, unknown> | null;
    if (parentRec && (parentRec.child_count as number) > 0) {
      const games = await storage.select('match_game', { parent_id: id });
      if (Array.isArray(games)) {
        for (const game of games) {
          const g = game as unknown as Record<string, unknown>;
          await storage.update('match_game', g.id as number, {
            ...g,
            status: status ?? g.status,
            opponent1: opponent1 ? { ...(g.opponent1 as object ?? {}), ...opponent1 } : g.opponent1,
            opponent2: opponent2 ? { ...(g.opponent2 as object ?? {}), ...opponent2 } : g.opponent2,
          } as never);
        }
      }
    }
  }

  res.json({ ok: true });
}));

app.patch('/api/match-game', wrap(async (req, res) => {
  await manager.update.matchGame(req.body);
  res.json({ ok: true });
}));

app.patch('/api/seeding/:stageId', wrap(async (req, res) => {
  const stageId = Number(req.params.stageId);
  await manager.update.seeding(stageId, req.body.seeding, req.body.keepSameSize);
  res.json({ ok: true });
}));

app.patch('/api/seeding/:stageId/confirm', wrap(async (req, res) => {
  await manager.update.confirmSeeding(Number(req.params.stageId));
  res.json({ ok: true });
}));

app.patch('/api/match/:id/child-count', wrap(async (req, res) => {
  const { level, count } = req.body;
  await manager.update.matchChildCount(level, Number(req.params.id), count);
  res.json({ ok: true });
}));

app.patch('/api/round/:roundId/ordering', wrap(async (req, res) => {
  await manager.update.roundOrdering(Number(req.params.roundId), req.body.ordering);
  res.json({ ok: true });
}));

// ═════════════════════════════════════════════════════════════════════════════
// GET (manager.get)
// ═════════════════════════════════════════════════════════════════════════════
app.get('/api/stage/:stageId/data', wrap(async (req, res) => {
  res.json(await manager.get.stageData(Number(req.params.stageId)));
}));

app.get('/api/tournament/:tournamentId/data', wrap(async (req, res) => {
  res.json(await manager.get.tournamentData(Number(req.params.tournamentId)));
}));

app.get('/api/stage/:stageId/seeding', wrap(async (req, res) => {
  res.json(await manager.get.seeding(Number(req.params.stageId)));
}));

app.get('/api/stage/:stageId/standings', wrap(async (req, res) => {
  const stageId = Number(req.params.stageId);
  try {
    const { pointsForWin, pointsForDraw, pointsForLoss } = req.query;
    if (pointsForWin !== undefined) {
      const opts = {
        pointsForWin: Number(pointsForWin),
        pointsForDraw: Number(pointsForDraw ?? 1),
        pointsForLoss: Number(pointsForLoss ?? 0),
      };
      res.json(await manager.get.finalStandings(stageId, opts));
    } else {
      res.json(await manager.get.finalStandings(stageId));
    }
  } catch (e: unknown) {
    // finalStandings throws for unsupported stage types and for in-progress brackets.
    // Return empty array so the UI degrades gracefully instead of showing a 400.
    console.warn('[route] standings unavailable for stage', stageId, '—', (e as Error).message ?? e);
    res.json([]);
  }
}));

app.get('/api/tournament/:tournamentId/current-stage', wrap(async (req, res) => {
  res.json(await manager.get.currentStage(Number(req.params.tournamentId)));
}));

app.get('/api/stage/:stageId/current-round', wrap(async (req, res) => {
  res.json(await manager.get.currentRound(Number(req.params.stageId)));
}));

app.get('/api/stage/:stageId/current-matches', wrap(async (req, res) => {
  try {
    res.json(await manager.get.currentMatches(Number(req.params.stageId)));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const isGraceful = msg.includes('Not implemented') || msg.toLowerCase().includes('not found');
    if (isGraceful) {
      res.json([]);
    } else {
      throw e;
    }
  }
}));

app.get('/api/match/:id/games', wrap(async (req, res) => {
  res.json(await manager.get.matchGames(Number(req.params.id)));
}));

// ═════════════════════════════════════════════════════════════════════════════
// FIND (manager.find)
// ═════════════════════════════════════════════════════════════════════════════
app.get('/api/match/:id', wrap(async (req, res) => {
  res.json(await manager.find.match(Number(req.params.id)));
}));

app.get('/api/match-game/:id', wrap(async (req, res) => {
  res.json(await manager.find.matchGame(Number(req.params.id)));
}));

app.get('/api/match/:id/next', wrap(async (req, res) => {
  res.json(await manager.find.nextMatches(Number(req.params.id)));
}));

app.get('/api/match/:id/previous', wrap(async (req, res) => {
  res.json(await manager.find.previousMatches(Number(req.params.id)));
}));

app.get('/api/stage/:stageId/upper-bracket', wrap(async (req, res) => {
  res.json(await manager.find.upperBracket(Number(req.params.stageId)));
}));

app.get('/api/stage/:stageId/loser-bracket', wrap(async (req, res) => {
  res.json(await manager.find.loserBracket(Number(req.params.stageId)));
}));

// ═════════════════════════════════════════════════════════════════════════════
// RESET (manager.reset)
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/match/:id/reset', wrap(async (req, res) => {
  await manager.reset.matchResults(Number(req.params.id));
  res.json({ ok: true });
}));

app.post('/api/match-game/:id/reset', wrap(async (req, res) => {
  await manager.reset.matchGameResults(Number(req.params.id));
  res.json({ ok: true });
}));

app.post('/api/stage/:stageId/reset-seeding', wrap(async (req, res) => {
  await manager.reset.seeding(Number(req.params.stageId));
  res.json({ ok: true });
}));

// ═════════════════════════════════════════════════════════════════════════════
// DELETE (manager.delete)
// ═════════════════════════════════════════════════════════════════════════════
app.delete('/api/stage/:id', wrap(async (req, res) => {
  const stageId = Number(req.params.id);
  const stage = db.prepare('SELECT tournament_id FROM stage WHERE id = ?').get(stageId) as { tournament_id: number } | undefined;
  if (stage) {
    const tournament = db.prepare('SELECT started_at FROM tournament WHERE id = ?').get(stage.tournament_id) as { started_at: string | null } | undefined;
    if (tournament?.started_at) {
      res.status(409).json({ error: 'Cannot delete a stage from a started tournament' });
      return;
    }
  }
  // Use a direct transaction instead of manager.delete.stage() which issues
  // dozens of individual queries and can exceed nginx proxy timeouts.
  db.transaction(() => {
    db.prepare('DELETE FROM match_game WHERE stage_id = ?').run(stageId);
    db.prepare('DELETE FROM match     WHERE stage_id = ?').run(stageId);
    db.prepare('DELETE FROM round     WHERE stage_id = ?').run(stageId);
    db.prepare('DELETE FROM "group"   WHERE stage_id = ?').run(stageId);
    db.prepare('DELETE FROM stage     WHERE id = ?').run(stageId);
  })();
  exportCache = null;
  res.json({ ok: true });
}));

app.post('/api/stage/:id/grand-final-reset', wrap(async (req, res) => {
  const stageId = Number(req.params.id);

  const gfGroup = db.prepare(
    `SELECT * FROM 'group' WHERE stage_id = ? ORDER BY number DESC LIMIT 1`
  ).get(stageId) as { id: number; number: number } | undefined;
  if (!gfGroup) { res.status(404).json({ error: 'Stage not found' }); return; }

  const existingRound2 = db.prepare(
    'SELECT id FROM round WHERE group_id = ? AND number = 2'
  ).get(gfGroup.id);
  if (existingRound2) { res.status(409).json({ error: 'Grand final reset match already exists' }); return; }

  const round1 = db.prepare(
    'SELECT id FROM round WHERE group_id = ? AND number = 1'
  ).get(gfGroup.id) as { id: number } | undefined;
  if (!round1) { res.status(404).json({ error: 'Grand final round not found' }); return; }

  const gfMatch = db.prepare('SELECT * FROM match WHERE round_id = ?').get(round1.id) as {
    status: number; opponent1: string | null; opponent2: string | null;
  } | undefined;
  if (!gfMatch || (gfMatch.status ?? 0) < 4) {
    res.status(409).json({ error: 'Grand final match is not yet complete' }); return;
  }

  const opp1 = gfMatch.opponent1 ? JSON.parse(gfMatch.opponent1) : null;
  const opp2 = gfMatch.opponent2 ? JSON.parse(gfMatch.opponent2) : null;
  if (!opp1 || !opp2) { res.status(409).json({ error: 'Grand final has a BYE slot' }); return; }
  if (opp1.result !== 'loss') {
    res.status(409).json({ error: 'WB finalist won the grand final — no reset needed' }); return;
  }

  db.transaction(() => {
    const r2 = db.prepare(
      'INSERT INTO round (stage_id, group_id, number) VALUES (?, ?, 2)'
    ).run(stageId, gfGroup.id);
    db.prepare(
      'INSERT INTO match (stage_id, group_id, round_id, number, child_count, status, opponent1, opponent2) VALUES (?, ?, ?, 1, 0, 2, ?, ?)'
    ).run(stageId, gfGroup.id, r2.lastInsertRowid,
      JSON.stringify({ id: opp1.id }),
      JSON.stringify({ id: opp2.id }),
    );
  })();

  exportCache = null;
  res.json({ ok: true });
}));

app.post('/api/tournament/:id/start', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const stages = db.prepare('SELECT id FROM stage WHERE tournament_id = ?').all(id) as { id: number }[];
  for (const { id: stageId } of stages) {
    try {
      await manager.update.confirmSeeding(stageId);
    } catch {
      // Stage already confirmed or no seeding to confirm — skip
    }
  }
  db.prepare("UPDATE tournament SET started_at = datetime('now') WHERE id = ?").run(id);
  exportCache = null;
  res.json({ ok: true });
}));

app.patch('/api/tournament/:id', wrap(async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  db.prepare('UPDATE tournament SET name = ? WHERE id = ?').run(name.trim(), Number(req.params.id));
  res.json({ ok: true });
}));

app.delete('/api/tournament/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  db.transaction(() => {
    const stageIds = (db.prepare('SELECT id FROM stage WHERE tournament_id = ?').all(id) as { id: number }[]).map(r => r.id);
    for (const sid of stageIds) {
      db.prepare('DELETE FROM match_game WHERE stage_id = ?').run(sid);
      db.prepare('DELETE FROM match     WHERE stage_id = ?').run(sid);
      db.prepare('DELETE FROM round     WHERE stage_id = ?').run(sid);
      db.prepare('DELETE FROM "group"   WHERE stage_id = ?').run(sid);
      db.prepare('DELETE FROM stage     WHERE id = ?').run(sid);
    }
    db.prepare('DELETE FROM participant  WHERE tournament_id = ?').run(id);
    db.prepare('DELETE FROM tournament   WHERE id = ?').run(id);
  })();
  exportCache = null;
  res.json({ ok: true });
}));

// ═════════════════════════════════════════════════════════════════════════════
// DELETE /api/reset   — wipe all bracket data, keep participants
// ═════════════════════════════════════════════════════════════════════════════
app.delete('/api/reset', wrap(async (_req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM match_game').run();
    db.prepare('DELETE FROM match').run();
    db.prepare('DELETE FROM round').run();
    db.prepare('DELETE FROM "group"').run();
    db.prepare('DELETE FROM stage').run();
    db.prepare('DELETE FROM tournament').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('match_game','match','round','group','stage','tournament')").run();
  })();
  exportCache = null;
  res.json({ ok: true });
}));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Bracket API running at http://localhost:${PORT}`);
});
