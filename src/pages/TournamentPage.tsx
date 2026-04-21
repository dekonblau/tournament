import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Swords, Trophy, Users, ChevronRight, Trash2, Pencil, Check, X, PlayCircle, UserPlus } from 'lucide-react';
import { useManager } from '../store/managerContext';
import { Card, Badge, Confirm, Divider } from '../components/ui/index';
import { Button } from '../components/ui/Button';
import { CreateStageModal } from '../components/CreateStageModal';
import { useToast } from '../components/ui/index';
import type { Stage } from 'brackets-model';

export function TournamentPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const id = Number(tournamentId);
  const { tournaments, db, delete: del, deleteTournament, renameTournament, startTournament, refresh, addParticipants, removeParticipant, renameParticipant } = useManager();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [deleteTournamentOpen, setDeleteTournamentOpen] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [addingParticipants, setAddingParticipants] = useState(false);
  const [participantInput, setParticipantInput] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);
  const [editingParticipantId, setEditingParticipantId] = useState<number | null>(null);
  const [editingParticipantName, setEditingParticipantName] = useState('');

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
        open={startConfirmOpen}
        title="Start tournament?"
        message="TBD slots will become BYEs and bracket progression will begin. This cannot be undone."
        danger={false}
        onConfirm={async () => {
          setStartConfirmOpen(false);
          await startTournament(id);
          toast('Tournament started', 'success');
        }}
        onCancel={() => setStartConfirmOpen(false)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                Created {new Date(tournament.createdAt).toLocaleDateString()}
              </p>
              {tournament.startedAt ? (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  Started {new Date(tournament.startedAt).toLocaleDateString()}
                </span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Registration open
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!tournament.startedAt && stages.length > 0 && (
              <Button variant="success" icon={<PlayCircle size={15} />} onClick={() => setStartConfirmOpen(true)}>
                Start Tournament
              </Button>
            )}
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setDeleteTournamentOpen(true)}>
              Delete
            </Button>
            {!tournament.startedAt && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreateOpen(true)}>
                Add Stage
              </Button>
            )}
          </div>
        </div>

        {/* Participants management */}
        {(() => {
          const tournamentParticipants = db.participant.filter((p) => p.tournament_id === id);
          const showSection = tournamentParticipants.length > 0 || !tournament.startedAt;
          if (!showSection) return null;

          const handleAddParticipants = async () => {
            const names = participantInput.split('\n').map((n) => n.trim()).filter(Boolean);
            if (!names.length) return;
            setAddingLoading(true);
            try {
              await addParticipants(id, names);
              setParticipantInput('');
              setAddingParticipants(false);
              toast(`Added ${names.length} participant${names.length > 1 ? 's' : ''}`, 'success');
            } catch (e: unknown) {
              toast(e instanceof Error ? e.message : 'Failed to add participants', 'error');
            } finally {
              setAddingLoading(false);
            }
          };

          const handleRemoveParticipant = async (pid: number) => {
            try {
              await removeParticipant(pid);
              toast('Participant removed', 'info');
            } catch (e: unknown) {
              toast(e instanceof Error ? e.message : 'Cannot remove participant', 'error');
            } finally {
              setRemoveTargetId(null);
            }
          };

          const handleRenameParticipant = async () => {
            if (!editingParticipantId) return;
            const trimmed = editingParticipantName.trim();
            if (!trimmed) return;
            try {
              await renameParticipant(editingParticipantId, trimmed);
              toast('Participant renamed', 'success');
            } catch (e: unknown) {
              toast(e instanceof Error ? e.message : 'Failed to rename', 'error');
            } finally {
              setEditingParticipantId(null);
            }
          };

          return (
            <>
              <Confirm
                open={removeTargetId !== null}
                title="Remove participant?"
                message={`Remove "${tournamentParticipants.find((p) => p.id === removeTargetId)?.name}"? This cannot be undone.`}
                danger
                onConfirm={() => removeTargetId !== null && handleRemoveParticipant(removeTargetId)}
                onCancel={() => setRemoveTargetId(null)}
              />
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: tournamentParticipants.length > 0 || addingParticipants ? '12px' : '0' }}>
                  <Users size={15} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 500 }}>Participants</span>
                  {tournamentParticipants.length > 0 && <Badge variant="accent">{tournamentParticipants.length}</Badge>}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    {!tournament.startedAt && !addingParticipants && (
                      <Button variant="ghost" size="sm" icon={<UserPlus size={13} />} onClick={() => setAddingParticipants(true)}>
                        Add
                      </Button>
                    )}
                  </div>
                </div>

                {tournamentParticipants.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: addingParticipants ? '12px' : '0' }}>
                    {tournamentParticipants.map((p) => (
                      editingParticipantId === p.id ? (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            autoFocus
                            value={editingParticipantName}
                            onChange={(e) => setEditingParticipantName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameParticipant(); if (e.key === 'Escape') setEditingParticipantId(null); }}
                            style={{
                              fontSize: '12px', padding: '2px 8px',
                              background: 'var(--bg-elevated)', border: '1px solid var(--accent)',
                              borderRadius: '99px', color: 'var(--text-primary)',
                              outline: 'none', fontFamily: 'var(--font-sans)', width: '120px',
                            }}
                          />
                          <button onClick={handleRenameParticipant} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', display: 'flex', padding: '2px' }}><Check size={13} /></button>
                          <button onClick={() => setEditingParticipantId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}><X size={13} /></button>
                        </div>
                      ) : (
                        <span
                          key={p.id}
                          style={{
                            fontSize: '12px', padding: '3px 8px 3px 10px',
                            background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                            borderRadius: '99px', color: 'var(--text-secondary)',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          {p.name}
                          {!tournament.startedAt && (
                            <>
                              <button
                                onClick={() => { setEditingParticipantId(p.id as number); setEditingParticipantName(p.name); }}
                                title="Rename"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '1px', opacity: 0.5, transition: 'opacity 0.15s' }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                              ><Pencil size={10} /></button>
                              <button
                                onClick={() => setRemoveTargetId(p.id as number)}
                                title="Remove"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '1px', opacity: 0.5, transition: 'opacity 0.15s, color 0.15s' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                              ><X size={10} /></button>
                            </>
                          )}
                        </span>
                      )
                    ))}
                  </div>
                )}

                {addingParticipants && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      autoFocus
                      value={participantInput}
                      onChange={(e) => setParticipantInput(e.target.value)}
                      placeholder="One participant name per line"
                      rows={4}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                        padding: '8px 10px', fontSize: '13px',
                        fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" onClick={() => { setAddingParticipants(false); setParticipantInput(''); }}>Cancel</Button>
                      <Button variant="primary" size="sm" loading={addingLoading} onClick={handleAddParticipants}>Add Participants</Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        })()}

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
