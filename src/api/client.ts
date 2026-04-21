/**
 * Typed API client — mirrors every endpoint in server/index.ts.
 * All manager operations go through here; nothing in the React app
 * touches brackets-manager directly.
 */

// In dev, Vite proxies /api → http://localhost:3001, so we use relative paths.
// In production, set VITE_API_URL to your server's origin.
const BASE = import.meta.env.VITE_API_URL ?? '';

// ─── Core fetch helper ────────────────────────────────────────────────────────
async function api<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

const get  = <T>(path: string)                  => api<T>('GET',    path);
const post = <T>(path: string, body?: unknown)  => api<T>('POST',   path, body);
const patch = <T>(path: string, body?: unknown) => api<T>('PATCH',  path, body);
const del  = <T>(path: string)                  => api<T>('DELETE', path);

// ─── Types (re-exported for convenience) ─────────────────────────────────────
export type {
  Stage, Match, Participant, Round, Group, MatchGame,
} from 'brackets-model';

import type {
  Stage, Match, Participant, Round, Group, MatchGame,
} from 'brackets-model';

export interface TournamentRecord {
  id: number;
  name: string;
  created_at: string;
}

export interface DBSnapshot {
  stage: Stage[];
  match: Match[];
  match_game: MatchGame[];
  participant: Participant[];
  round: Round[];
  group: Group[];
  tournament?: TournamentRecord[];
}

export interface FinalStandingsItem {
  id: number;
  name: string;
  rank: number;
}

export interface RoundRobinStandingsItem {
  id: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

export interface StageData {
  stage: Stage;
  groups: Group[];
  rounds: Round[];
  matches: Match[];
  matchGames: MatchGame[];
  participants: Participant[];
}

// ─── Export / Import ──────────────────────────────────────────────────────────
export const exportData = () =>
  get<DBSnapshot>('/api/export');

export const importData = (data: DBSnapshot, normalizeIds = false) =>
  post<{ ok: true }>('/api/import', { data, normalizeIds });

// ─── Create ───────────────────────────────────────────────────────────────────
export interface InputStage {
  name: string;
  tournamentId: number;
  type: 'single_elimination' | 'double_elimination' | 'round_robin';
  seeding?: (string | null)[];
  seedingIds?: (number | null)[];
  settings?: {
    grandFinal?: 'simple' | 'double';
    consolationFinal?: boolean;
    matchesChildCount?: number;
    seedOrdering?: string[];
    balanceByes?: boolean;
    roundRobinMode?: 'simple' | 'double';
    groupCount?: number;
    size?: number;
  };
}

export const createStage = (input: InputStage) =>
  post<Stage>('/api/stage', input);

// ─── Update ───────────────────────────────────────────────────────────────────
export interface MatchUpdateInput {
  id: number;
  status?: number;
  opponent1?: {
    id?: number | null;
    score?: number;
    result?: 'win' | 'loss' | 'draw';
    forfeit?: boolean;
  } | null;
  opponent2?: {
    id?: number | null;
    score?: number;
    result?: 'win' | 'loss' | 'draw';
    forfeit?: boolean;
  } | null;
}

export const updateMatch = (input: MatchUpdateInput) =>
  patch<{ ok: true }>('/api/match', input);

export const updateMatchGame = (input: MatchUpdateInput) =>
  patch<{ ok: true }>('/api/match-game', input);

export const updateSeeding = (
  stageId: number,
  seeding: (string | null)[],
  keepSameSize?: boolean
) => patch<{ ok: true }>(`/api/seeding/${stageId}`, { seeding, keepSameSize });

export const confirmSeeding = (stageId: number) =>
  patch<{ ok: true }>(`/api/seeding/${stageId}/confirm`);

export const updateMatchChildCount = (
  level: 'stage' | 'group' | 'round' | 'match',
  id: number,
  count: number
) => patch<{ ok: true }>(`/api/match/${id}/child-count`, { level, count });

export const updateRoundOrdering = (roundId: number, ordering: string) =>
  patch<{ ok: true }>(`/api/round/${roundId}/ordering`, { ordering });

// ─── Get ──────────────────────────────────────────────────────────────────────
export const getStageData = (stageId: number) =>
  get<StageData>(`/api/stage/${stageId}/data`);

export const getTournamentData = (tournamentId: number) =>
  get<DBSnapshot>(`/api/tournament/${tournamentId}/data`);

export const getSeeding = (stageId: number) =>
  get<(Participant | null)[]>(`/api/stage/${stageId}/seeding`);

export const getFinalStandings = (stageId: number) =>
  get<FinalStandingsItem[]>(`/api/stage/${stageId}/standings`);

export const getRRStandings = (stageId: number) =>
  get<RoundRobinStandingsItem[]>(
    `/api/stage/${stageId}/standings?pointsForWin=3&pointsForDraw=1&pointsForLoss=0`
  );

export const getCurrentStage = (tournamentId: number) =>
  get<Stage | null>(`/api/tournament/${tournamentId}/current-stage`);

export const getCurrentRound = (stageId: number) =>
  get<Round | null>(`/api/stage/${stageId}/current-round`);

export const getCurrentMatches = (stageId: number) =>
  get<Match[]>(`/api/stage/${stageId}/current-matches`);

export const getMatchGames = (matchId: number) =>
  get<MatchGame[]>(`/api/match/${matchId}/games`);

// ─── Find ─────────────────────────────────────────────────────────────────────
export const findMatch = (id: number) =>
  get<Match>(`/api/match/${id}`);

export const findMatchGame = (id: number) =>
  get<MatchGame>(`/api/match-game/${id}`);

export const findNextMatches = (matchId: number) =>
  get<(Match | null)[]>(`/api/match/${matchId}/next`);

export const findPreviousMatches = (matchId: number) =>
  get<(Match | null)[]>(`/api/match/${matchId}/previous`);

export const findUpperBracket = (stageId: number) =>
  get<Group>(`/api/stage/${stageId}/upper-bracket`);

export const findLoserBracket = (stageId: number) =>
  get<Group | null>(`/api/stage/${stageId}/loser-bracket`);

// ─── Reset ────────────────────────────────────────────────────────────────────
export const resetMatchResults = (matchId: number) =>
  post<{ ok: true }>(`/api/match/${matchId}/reset`);

export const resetMatchGameResults = (matchGameId: number) =>
  post<{ ok: true }>(`/api/match-game/${matchGameId}/reset`);

export const resetSeeding = (stageId: number) =>
  post<{ ok: true }>(`/api/stage/${stageId}/reset-seeding`);

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteStage = (stageId: number) =>
  del<{ ok: true }>(`/api/stage/${stageId}`);

export const getTournaments = () =>
  get<TournamentRecord[]>('/api/tournaments');

export const createTournamentRecord = (name: string) =>
  post<TournamentRecord>('/api/tournament', { name });

export const deleteTournamentStages = (tournamentId: number) =>
  del<{ ok: true }>(`/api/tournament/${tournamentId}`);

export const resetAllData = () =>
  del<{ ok: true }>('/api/reset');
