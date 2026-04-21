import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Swords, Trophy, Users, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react';
import { useManager } from '../store/managerContext';
import { Card, Badge, Confirm, Divider } from '../components/ui/index';
import { Button } from '../components/ui/Button';
import { CreateStageModal } from '../components/CreateStageModal';
import { useToast } from '../components/ui/index';
import type { Stage } from 'brackets-model';

export function TournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const id = Number(tournamentId);
  const { tournaments, db, delete: del, deleteTournament, renameTournament, refresh } = useManager();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [deleteTournamentOpen, setDeleteTournamentOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startRename = () => {
    setNameValue(tournament?.name ?? '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const commitRename = async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== tournament?.name) {
      await renameTournament(id, trimmed);
      toast(`Renamed to "${trimmed}"`, 'success');
    }
    setEditingName(false);
  };

  const tournament = tournaments.find((t) => t.id === id);
  const stages = db.stage.filter((s) => s.tournament_id === id);

  if (!tournament) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px', color: 'var(--text-muted)' }}>
        <Trophy size={40} style={{ opacity: 0.3 }} />
        <h2>Tournament not found</h2>
        <Button variant="secondary" onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  const handleDeleteStage = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await del.stage(Number(target.id));
      await refresh();
      toast(`Stage "${target.name}" deleted`, 'info');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to delete stage', 'error');
    }
  };

  return (
    <>
      <CreateStageModal open={createOpen} onClose={() => setCreateOpen(false)} tournamentId={id} />
      <Confirm
        open={!!deleteTarget}
        title="Delete stage?"
        message={`Delete "${deleteTarget?.name}"? All matches and results will be permanently removed.`}
        danger
        onConfirm={handleDeleteStage}
        onCancel={() => setDeleteTarget(null)}
      />
      <Confirm
        open={deleteTournamentOpen}
        title="Delete tournament?"
        message={`Delete "${tournament?.name}"? All stages, matches, and results will be permanently removed.`}
        danger
        onConfirm={async () => {
          setDeleteTournamentOpen(false);
          await deleteTournament(id);
          toast(`Tournament deleted`, 'info');
          navigate('/');
        }}
        onCancel={() => setDeleteTournamentOpen(false)}
      />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Dashboard</span>
              <ChevronRight size={12} />
              <span>{tournament.name}</span>
            </div>
            {editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingName(false); }}
                  style={{
                    fontSize: '24px', fontWeight: 700, background: 'var(--bg-elevated)',
                    border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)', padding: '2px 8px', outline: 'none',
                    fontFamily: 'var(--font-sans)', width: '320px',
                  }}
                />
                <button onClick={commitRename} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'flex' }}><Check size={18} /></button>
                <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={18} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ margin: 0 }}>{tournament.name}</h1>
                <button onClick={startRename} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px', opacity: 0.5, transition: 'opacity 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                ><Pencil size={14} /></button>
              </div>
            )}
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Created {new Date(tournament.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setDeleteTournamentOpen(true)}>
              Delete Tournament
            </Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
              Add Stage
            </Button>
          </div>
        </div>

        {/* Participants summary */}
        {db.participant.filter((p) => p.tournament_id === id).length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Users size={15} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Participants</span>
              <Badge variant="accent">{db.participant.filter((p) => p.tournament_id === id).length}</Badge>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {db.participant.filter((p) => p.tournament_id === id).map((p) => (
                <span key={p.id} style={{ fontSize: '12px', padding: '3px 10px', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: '99px', color: 'var(--text-secondary)' }}>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <Divider style={{ marginBottom: '24px' }} />

        {/* Stages */}
        <h2 style={{ marginBottom: '16px' }}>
          Stages
          {stages.length > 0 && <Badge variant="muted" style={{ marginLeft: '10px' } as React.CSSProperties}>{stages.length}</Badge>}
        </h2>

        {stages.length === 0 ? (
          <Card style={{ padding: '52px', textAlign: 'center' }}>
            <Swords size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 14px', opacity: 0.4 }} />
            <h3 style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>No stages yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              Create a stage to start building your bracket
            </p>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              Create First Stage
            </Button>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {stages.map((stage) => {
              const stageMatches = db.match.filter((m) => m.stage_id === stage.id);
              const done = stageMatches.filter((m) => (m.status ?? 0) >= 4).length;
              const pct = stageMatches.length ? Math.round((done / stageMatches.length) * 100) : 0;
              const participants = db.participant.filter((p) => p.tournament_id === stage.tournament_id);
              const typeLabel = stage.type === 'single_elimination' ? 'Single Elim' : stage.type === 'double_elimination' ? 'Double Elim' : 'Round Robin';
              const typeVariant = stage.type === 'single_elimination' ? 'green' : stage.type === 'double_elimination' ? 'amber' : 'accent';

              return (
                <div key={stage.id} style={{ position: 'relative' }}>
                  <Card
                    onClick={() => navigate(`/tournament/${id}/stage/${stage.id}`)}
                    style={{ padding: '20px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ marginBottom: '4px' }}>{stage.name}</h3>
                        <Badge variant={typeVariant as never}>{typeLabel}</Badge>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(stage); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '2px', display: 'flex',
                          opacity: 0.5, transition: 'opacity 0.15s, color 0.15s',
                          borderRadius: '4px',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      {participants.length} participants · {stageMatches.length} matches
                    </div>

                    {/* Progress */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '5px' }}>
                        <span>Progress</span>
                        <span>{pct}%</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--bg-overlay)', borderRadius: 99 }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, transition: 'width 0.3s', background: pct === 100 ? 'var(--green)' : 'var(--accent)' }} />
                      </div>
                    </div>

                    {pct === 100 && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>
                        🏆 Stage complete
                      </div>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
