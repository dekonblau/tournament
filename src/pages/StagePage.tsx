import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronRight, Shuffle, Trophy, List, BarChart2,
  RefreshCw, Edit3, Swords,
} from 'lucide-react';
import { useManager } from '../store/managerContext';
import { BracketViewer } from '../components/BracketViewer';
import { MatchUpdateModal } from '../components/MatchUpdateModal';
import { SeedingEditor } from '../components/SeedingEditor';
import { Tabs, Badge, MatchStatusBadge, Divider, Card } from '../components/ui/index';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/index';
import type { Stage, Round } from 'brackets-model';

type TabId = 'bracket' | 'matches' | 'standings' | 'participants';

export function StagePage() {
  const { tournamentId, stageId } = useParams<{ tournamentId: string; stageId: string }>();
  const tid = Number(tournamentId);
  const sid = Number(stageId);

  const { tournaments, db, get, reset, refresh, getParticipantName, getFinalStandings, getRoundRobinStandings } = useManager();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>('bracket');
  const [activeMatchId, setActiveMatchId] = useState<number | null>(null);
  const [seedingOpen, setSeedingOpen] = useState(false);
  const [standings, setStandings] = useState<{ id: number; name: string; rank?: number; points?: number; wins?: number; losses?: number; played?: number }[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [currentMatches, setCurrentMatches] = useState<number[]>([]);

  const tournament = tournaments.find((t) => t.id === tid);
  const stage: Stage | undefined = db.stage.find((s) => s.id === sid);
  const stageMatches = db.match.filter((m) => m.stage_id === sid);
  const stageRounds = db.round.filter((r) => r.stage_id === sid);
  const stageGroups = db.group.filter((g) => g.stage_id === sid);
  const participants = db.participant.filter((p) => p.tournament_id === tid);
  const matchGames = db.match_game.filter((g) => g.stage_id === sid);

  // Load standings whenever tab changes or matches update
  useEffect(() => {
    if (tab !== 'standings' || !stage) return;
    setLoadingStandings(true);
    const load = async () => {
      try {
        if (stage.type === 'round_robin') {
          const s = await getRoundRobinStandings(sid);
          setStandings(s.map((i) => ({ id: i.id, name: i.name, points: i.points, wins: i.wins, losses: i.losses, played: i.played })));
        } else {
          const s = await getFinalStandings(sid);
          setStandings(s.map((i) => ({ id: i.id, name: i.name, rank: i.rank })));
        }
      } catch {
        setStandings([]);
      } finally {
        setLoadingStandings(false);
      }
    };
    load();
  }, [tab, stage, sid, stageMatches.filter((m) => (m.status ?? 0) >= 4).length]);

  // Current matches highlight
  useEffect(() => {
    get.currentMatches(sid).then((m) => setCurrentMatches(m.map((x) => x.id))).catch(() => {});
  }, [sid, stageMatches.length, stageMatches.filter((m) => (m.status ?? 0) >= 4).length]);

  const handleMatchClick = useCallback((matchId: number) => {
    setActiveMatchId(matchId);
  }, []);

  const handleResetSeeding = async () => {
    if (!stage) return;
    try {
      await reset.seeding(sid);
      await refresh();
      toast('Seeding reset', 'info');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to reset seeding', 'error');
    }
  };

  if (!stage || !tournament) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px', color: 'var(--text-muted)' }}>
        <Swords size={40} style={{ opacity: 0.3 }} />
        <h2>Stage not found</h2>
        <Button variant="secondary" onClick={() => navigate(`/tournament/${tournamentId}`)}>Back to Tournament</Button>
      </div>
    );
  }

  const done = stageMatches.filter((m) => (m.status ?? 0) >= 4).length;
  const pct = stageMatches.length ? Math.round((done / stageMatches.length) * 100) : 0;
  const typeLabel = stage.type === 'single_elimination' ? 'Single Elimination' : stage.type === 'double_elimination' ? 'Double Elimination' : 'Round Robin';
  const typeVariant = stage.type === 'single_elimination' ? 'green' : stage.type === 'double_elimination' ? 'amber' : 'accent';

  const roundMap: Record<number, Round> = {};
  stageRounds.forEach((r) => { roundMap[r.id] = r; });

  return (
    <>
      <MatchUpdateModal matchId={activeMatchId} onClose={() => setActiveMatchId(null)} />
      {stage && <SeedingEditor open={seedingOpen} onClose={() => setSeedingOpen(false)} stage={stage} />}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Dashboard</span>
            <ChevronRight size={12} />
            <span style={{ cursor: 'pointer' }} onClick={() => navigate(`/tournament/${tid}`)}>{tournament.name}</span>
            <ChevronRight size={12} />
            <span style={{ color: 'var(--text-secondary)' }}>{stage.name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px' }}>{stage.name}</h2>
              <Badge variant={typeVariant as never}>{typeLabel}</Badge>
              <Badge variant="muted">{participants.length} teams</Badge>
              {pct === 100 && <Badge variant="green">🏆 Complete</Badge>}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!tournament.startedAt && (
                <Button variant="ghost" size="sm" icon={<Shuffle size={13} />} onClick={() => setSeedingOpen(true)}>
                  Edit Seeding
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={() => { refresh(); toast('Refreshed', 'info'); }}>
                Refresh
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-overlay)', borderRadius: 99 }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: pct === 100 ? 'var(--green)' : 'var(--accent)', transition: 'width 0.4s' }} />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{done}/{stageMatches.length} matches</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <Tabs
            active={tab}
            onChange={(id) => setTab(id as TabId)}
            tabs={[
              { id: 'bracket', label: 'Bracket', icon: <Trophy size={14} /> },
              { id: 'matches', label: `Matches (${stageMatches.length})`, icon: <Swords size={14} /> },
              { id: 'standings', label: 'Standings', icon: <BarChart2 size={14} /> },
              { id: 'participants', label: `Participants (${participants.length})`, icon: <List size={14} /> },
            ]}
          />
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── BRACKET TAB ── */}
          {tab === 'bracket' && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'auto', minHeight: 300 }}>
              <div style={{ padding: '8px 0' }}>
                <BracketViewer
                  stages={[stage]}
                  matches={stageMatches}
                  matchGames={matchGames}
                  participants={participants}
                  onMatchClick={handleMatchClick}
                />
              </div>
              {stageMatches.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Click any match to update its result
                </div>
              )}
            </div>
          )}

          {/* ── MATCHES TAB ── */}
          {tab === 'matches' && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Round', 'Match', 'Participant 1', 'Score', 'Participant 2', 'Status', ''].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stageMatches.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No matches</td></tr>
                  ) : (
                    stageMatches.map((m) => {
                      const round = roundMap[m.round_id];
                      const isCurrent = currentMatches.includes(m.id);
                      // null opponent = BYE (slot closed); {id:null} = TBD (slot open)
                      const oppLabel = (opp: typeof m.opponent1) => {
                        if (opp == null) return 'BYE';
                        if (opp.id == null) return 'TBD';
                        return getParticipantName(opp.id as number);
                      };
                      const p1 = oppLabel(m.opponent1);
                      const p2 = oppLabel(m.opponent2);
                      const s1 = m.opponent1?.score;
                      const s2 = m.opponent2?.score;
                      const isReady = (m.status ?? 0) >= 2 && (m.status ?? 0) < 5;
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--border)', background: isCurrent ? 'var(--accent-dim)' : 'transparent', transition: 'background 0.1s' }}
                          onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isCurrent ? 'var(--accent-dim)' : 'transparent'; }}
                        >
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>R{round?.number ?? '?'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '12px' }}>#{m.number}</td>
                          <td style={{ padding: '10px 14px', fontWeight: m.opponent1?.result === 'win' ? 600 : 400, color: m.opponent1?.result === 'win' ? 'var(--green)' : 'var(--text-primary)' }}>{p1}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            {s1 !== undefined && s2 !== undefined ? `${s1} – ${s2}` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: m.opponent2?.result === 'win' ? 600 : 400, color: m.opponent2?.result === 'win' ? 'var(--green)' : 'var(--text-primary)' }}>{p2}</td>
                          <td style={{ padding: '10px 14px' }}><MatchStatusBadge status={m.status ?? 0} /></td>
                          <td style={{ padding: '10px 14px' }}>
                            {isReady && (
                              <Button size="sm" variant="secondary" icon={<Edit3 size={12} />} onClick={() => setActiveMatchId(m.id)}>
                                Update
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── STANDINGS TAB ── */}
          {tab === 'standings' && (
            <div>
              {loadingStandings ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading standings…</div>
              ) : standings.length === 0 ? (
                <Card style={{ padding: '40px', textAlign: 'center' }}>
                  <BarChart2 size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px', opacity: 0.4 }} />
                  <p style={{ color: 'var(--text-muted)' }}>Standings will appear as matches are completed</p>
                </Card>
              ) : (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        {stage.type === 'round_robin'
                          ? ['#', 'Name', 'Played', 'W', 'L', 'Points'].map((h) => (
                              <th key={h} style={{ padding: '10px 16px', textAlign: h === '#' || h === 'Name' ? 'left' : 'center', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))
                          : ['Rank', 'Participant'].map((h) => (
                              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((item, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: i === 0 ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                            {stage.type === 'round_robin' ? (
                              <>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</td>
                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>{medal && <span style={{ marginRight: '6px' }}>{medal}</span>}{item.name}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.played ?? 0}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>{item.wins ?? 0}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--red)' }}>{item.losses ?? 0}</td>
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--accent-hover)' }}>{item.points ?? 0}</td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-muted)', width: 80 }}>
                                  {medal ? <span>{medal}</span> : <span>#{item.rank}</span>}
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: i < 3 ? 600 : 400, color: i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--text-primary)' }}>
                                  {item.name}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PARTICIPANTS TAB ── */}
          {tab === 'participants' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {participants.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No participants</div>
              ) : participants.map((p, i) => {
                const wins = stageMatches.filter((m) =>
                  (m.opponent1?.id === p.id && m.opponent1?.result === 'win') ||
                  (m.opponent2?.id === p.id && m.opponent2?.result === 'win')
                ).length;
                const losses = stageMatches.filter((m) =>
                  (m.opponent1?.id === p.id && m.opponent1?.result === 'loss') ||
                  (m.opponent2?.id === p.id && m.opponent2?.result === 'loss')
                ).length;
                return (
                  <Card key={p.id} style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: `hsl(${(p.id ?? i) * 47 % 360}, 60%, 35%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '13px', color: '#fff',
                      }}>
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seed #{i + 1}</div>
                      </div>
                    </div>
                    <Divider style={{ marginBottom: '10px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--green)' }}>{wins}</div><div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Wins</div></div>
                      <div><div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--red)' }}>{losses}</div><div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Losses</div></div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
