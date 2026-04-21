import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import * as api from '../api/client';
import type { DBSnapshot, FinalStandingsItem, RoundRobinStandingsItem, TournamentRecord } from '../api/client';
import type { Stage, Participant, Match, Round } from 'brackets-model';

export type { DBSnapshot };

export interface Tournament {
  id: number;
  name: string;
  createdAt: string;
  startedAt: string | null;
}

interface ManagerContextValue {
  db: DBSnapshot;
  refresh: () => Promise<void>;
  tournaments: Tournament[];
  createTournament: (name: string) => Promise<Tournament>;
  renameTournament: (id: number, name: string) => Promise<void>;
  startTournament: (id: number) => Promise<void>;
  deleteTournament: (id: number) => Promise<void>;
  create: { stage: typeof api.createStage };
  update: {
    match: typeof api.updateMatch;
    matchGame: typeof api.updateMatchGame;
    seeding: typeof api.updateSeeding;
    confirmSeeding: typeof api.confirmSeeding;
    matchChildCount: typeof api.updateMatchChildCount;
    roundOrdering: typeof api.updateRoundOrdering;
  };
  find: {
    match: typeof api.findMatch;
    matchGame: typeof api.findMatchGame;
    nextMatches: typeof api.findNextMatches;
    previousMatches: typeof api.findPreviousMatches;
    upperBracket: typeof api.findUpperBracket;
    loserBracket: typeof api.findLoserBracket;
  };
  get: {
    stageData: typeof api.getStageData;
    tournamentData: typeof api.getTournamentData;
    seeding: typeof api.getSeeding;
    finalStandings: typeof api.getFinalStandings;
    currentStage: typeof api.getCurrentStage;
    currentRound: typeof api.getCurrentRound;
    currentMatches: typeof api.getCurrentMatches;
    matchGames: typeof api.getMatchGames;
  };
  reset: {
    matchResults: typeof api.resetMatchResults;
    matchGameResults: typeof api.resetMatchGameResults;
    seeding: typeof api.resetSeeding;
  };
  delete: {
    stage: typeof api.deleteStage;
    tournament: typeof api.deleteTournamentStages;
  };
  exportData: () => Promise<DBSnapshot>;
  importData: (data: DBSnapshot, normalizeIds?: boolean) => Promise<void>;
  clearAll: () => Promise<void>;
  addParticipants: (tournamentId: number, names: string[]) => Promise<void>;
  renameParticipant: (id: number, name: string) => Promise<void>;
  removeParticipant: (id: number) => Promise<void>;
  getParticipantName: (id: number | null | undefined) => string;
  getStageMatches: (stageId: number) => Match[];
  getStageRounds: (stageId: number) => Round[];
  getStageParticipants: (stage: Stage) => Participant[];
  getFinalStandings: (stageId: number) => Promise<FinalStandingsItem[]>;
  getRoundRobinStandings: (stageId: number) => Promise<RoundRobinStandingsItem[]>;
}

const ManagerContext = createContext<ManagerContextValue | null>(null);

export function ManagerProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DBSnapshot>({
    stage: [], match: [], match_game: [], participant: [], round: [], group: [],
  });

  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const toTournament = (r: TournamentRecord): Tournament => ({
    id: r.id, name: r.name, createdAt: r.created_at, startedAt: r.started_at ?? null,
  });

  const refresh = useCallback(async () => {
    const [data, tList] = await Promise.all([api.exportData(), api.getTournaments()]);
    setDb(data);
    setTournaments(tList.map(toTournament));
  }, []);

  const createTournament = useCallback(async (name: string): Promise<Tournament> => {
    const rec = await api.createTournamentRecord(name);
    const t = toTournament(rec);
    setTournaments((prev) => [...prev, t]);
    return t;
  }, []);

  const renameTournament = useCallback(async (id: number, name: string) => {
    await api.renameTournamentRecord(id, name);
    setTournaments((prev) => prev.map((t) => t.id === id ? { ...t, name } : t));
  }, []);

  const startTournament = useCallback(async (id: number) => {
    await api.startTournamentApi(id);
    setTournaments((prev) => prev.map((t) => t.id === id ? { ...t, startedAt: new Date().toISOString() } : t));
    await refresh();
  }, [refresh]);

  const deleteTournament = useCallback(async (id: number) => {
    await api.deleteTournamentStages(id);
    setTournaments((prev) => prev.filter((t) => t.id !== id));
    await refresh();
  }, [refresh]);

  const exportData = useCallback(() => api.exportData(), []);
  const importData = useCallback(async (data: DBSnapshot, normalizeIds = false) => {
    await api.importData(data, normalizeIds);
    await refresh();
  }, [refresh]);

  const clearAll = useCallback(async () => {
    await api.resetAllData();
    setTournaments([]);
    await refresh();
  }, [refresh]);

  const addParticipants = useCallback(async (tournamentId: number, names: string[]) => {
    await api.addParticipants(tournamentId, names);
    await refresh();
  }, [refresh]);

  const renameParticipant = useCallback(async (id: number, name: string) => {
    await api.renameParticipant(id, name);
    await refresh();
  }, [refresh]);

  const removeParticipant = useCallback(async (id: number) => {
    await api.removeParticipant(id);
    await refresh();
  }, [refresh]);

  const getParticipantName = useCallback((id: number | null | undefined) => {
    if (id === null || id === undefined) return 'BYE';
    return db.participant.find((p) => p.id === id)?.name ?? `#${id}`;
  }, [db.participant]);

  const getStageMatches      = useCallback((sid: number) => db.match.filter((m) => m.stage_id === sid), [db.match]);
  const getStageRounds       = useCallback((sid: number) => db.round.filter((r) => r.stage_id === sid), [db.round]);
  const getStageParticipants = useCallback((stage: Stage) =>
    db.participant.filter((p) => p.tournament_id === stage.tournament_id), [db.participant]);

  const getFinalStandings = useCallback(async (stageId: number): Promise<FinalStandingsItem[]> => {
    try { return await api.getFinalStandings(stageId); } catch { return []; }
  }, []);

  const getRoundRobinStandings = useCallback(async (stageId: number): Promise<RoundRobinStandingsItem[]> => {
    try { return await api.getRRStandings(stageId); } catch { return []; }
  }, []);

  const value: ManagerContextValue = {
    db, refresh, tournaments, createTournament, renameTournament, startTournament, deleteTournament,
    create: { stage: api.createStage },
    update: {
      match: api.updateMatch,
      matchGame: api.updateMatchGame,
      seeding: api.updateSeeding,
      confirmSeeding: api.confirmSeeding,
      matchChildCount: api.updateMatchChildCount,
      roundOrdering: api.updateRoundOrdering,
    },
    find: {
      match: api.findMatch,
      matchGame: api.findMatchGame,
      nextMatches: api.findNextMatches,
      previousMatches: api.findPreviousMatches,
      upperBracket: api.findUpperBracket,
      loserBracket: api.findLoserBracket,
    },
    get: {
      stageData: api.getStageData,
      tournamentData: api.getTournamentData,
      seeding: api.getSeeding,
      finalStandings: api.getFinalStandings,
      currentStage: api.getCurrentStage,
      currentRound: api.getCurrentRound,
      currentMatches: api.getCurrentMatches,
      matchGames: api.getMatchGames,
    },
    reset: {
      matchResults: api.resetMatchResults,
      matchGameResults: api.resetMatchGameResults,
      seeding: api.resetSeeding,
    },
    delete: {
      stage: api.deleteStage,
      tournament: api.deleteTournamentStages,
    },
    exportData, importData, clearAll, addParticipants, renameParticipant, removeParticipant,
    getParticipantName, getStageMatches, getStageRounds, getStageParticipants,
    getFinalStandings, getRoundRobinStandings,
  };

  return <ManagerContext.Provider value={value}>{children}</ManagerContext.Provider>;
}

export function useManager() {
  const ctx = useContext(ManagerContext);
  if (!ctx) throw new Error('useManager must be used inside <ManagerProvider>');
  return ctx;
}
