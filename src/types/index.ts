import type { Stage, Match, Participant, Round, Group, MatchGame } from 'brackets-model';

export type { Stage, Match, Participant, Round, Group, MatchGame };

export interface Tournament {
  id: number;
  name: string;
  createdAt: string;
}

export interface StageWithMeta extends Stage {
  participantCount: number;
  completedMatches: number;
  totalMatches: number;
}

export interface MatchWithParticipants extends Match {
  p1Name?: string;
  p1Image?: string;
  p2Name?: string;
  p2Image?: string;
  roundNumber?: number;
}

export interface ParticipantWithMeta extends Participant {
  wins?: number;
  losses?: number;
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

export type StageType = 'single_elimination' | 'double_elimination' | 'round_robin';

export interface CreateStageInput {
  name: string;
  tournamentId: number;
  type: StageType;
  seeding: (string | null)[];
  settings: {
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

export type MatchStatus = 'locked' | 'waiting' | 'ready' | 'running' | 'completed' | 'archived';

export const MATCH_STATUS_MAP: Record<number, MatchStatus> = {
  0: 'locked',
  1: 'waiting',
  2: 'ready',
  3: 'running',
  4: 'completed',
  5: 'archived',
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  locked: 'Locked',
  waiting: 'Waiting',
  ready: 'Ready',
  running: 'Running',
  completed: 'Completed',
  archived: 'Archived',
};
