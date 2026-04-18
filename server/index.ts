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
// GET  /api/export          — full database export (used to seed the viewer)
// ═════════════════════════════════════════════════════════════════════════════
app.get('/api/export', wrap(async (_req, res) => {
  res.json(await manager.export());
}));

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/import          — import a full database snapshot
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/import', wrap(async (req, res) => {
  const { data, normalizeIds = false } = req.body;
  await manager.import(data, normalizeIds);
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

  // When scores are provided, write them directly to the match_game record
  // brackets-manager routes scores through match_game when child_count > 0
  // but loses the parent_id in the process — we handle it explicitly here
  if (id && (opponent1?.score !== undefined || opponent2?.score !== undefined)) {
    // Get all match_game rows for this match (child_count may be > 1)
    const existingGames = await storage.select('match_game', { parent_id: id });
    console.log('[route] existing match_games:', JSON.stringify(existingGames));

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
        console.log('[route] updating match_game:', JSON.stringify(updatedGame));
        await storage.update('match_game', gameRecord.id as number, updatedGame as never);
      }
    }

    // Also update the parent match status and opponent result fields
    const existingMatch = await storage.selectFirst('match', { id });
    if (existingMatch) {
      const matchRecord = existingMatch as Record<string, unknown>;
      const score1 = opponent1?.score ?? (matchRecord.opponent1 as Record<string,unknown>)?.score;
      const score2 = opponent2?.score ?? (matchRecord.opponent2 as Record<string,unknown>)?.score;
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
      console.log('[route] updating match directly:', JSON.stringify(updatedMatch));
      await storage.update('match', id, updatedMatch as never);
    }
  }

  try {
    await manager.update.match(req.body);
  } catch (e) {
    // manager.update.match fails when an opponent id is null (BYE / unresolved slot).
    // The direct writes above already persisted the scores — safe to swallow this.
    console.warn('[route] manager.update.match skipped (BYE/null opponent):', (e as Error).message);
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
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Not implemented') || msg.includes('not implemented')) {
      // Return empty standings rather than 400 for unsupported stage types
      res.json([]);
    } else {
      throw e;
    }
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
    if (msg.includes('Not implemented')) {
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
  await manager.delete.stage(Number(req.params.id));
  res.json({ ok: true });
}));

app.delete('/api/tournament/:id', wrap(async (req, res) => {
  await manager.delete.tournament(Number(req.params.id));
  res.json({ ok: true });
}));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Bracket API running at http://localhost:${PORT}`);
});
