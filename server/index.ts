import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { BracketsManager } from 'brackets-manager';
import { SqliteStorage } from './SqliteStorage.js';
import morgan from 'morgan';
//const morgan = import('morgan');

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
  await manager.update.match(req.body);
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
  // Pass round-robin scoring options if provided in query
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
}));

app.get('/api/tournament/:tournamentId/current-stage', wrap(async (req, res) => {
  res.json(await manager.get.currentStage(Number(req.params.tournamentId)));
}));

app.get('/api/stage/:stageId/current-round', wrap(async (req, res) => {
  res.json(await manager.get.currentRound(Number(req.params.stageId)));
}));

app.get('/api/stage/:stageId/current-matches', wrap(async (req, res) => {
  res.json(await manager.get.currentMatches(Number(req.params.stageId)));
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
