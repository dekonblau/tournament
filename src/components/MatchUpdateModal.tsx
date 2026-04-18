import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Input';
import { MatchStatusBadge } from './ui/index';
import { useManager } from '../store/managerContext';
import { useToast } from './ui/index';
import type { Match } from 'brackets-model';

interface Props {
  matchId: number | null;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: '2', label: 'Ready' },
  { value: '3', label: 'Running' },
  { value: '4', label: 'Completed' },
];

export function MatchUpdateModal({ matchId, onClose }: Props) {
  const { db, update, reset, refresh, getParticipantName } = useManager();
  const { toast } = useToast();

  const match: Match | undefined = db.match.find((m) => m.id === matchId);

  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [forfeit1, setForfeit1] = useState(false);
  const [forfeit2, setForfeit2] = useState(false);
  const [status, setStatus] = useState('2');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!match) return;
    setScore1(match.opponent1?.score ?? 0);
    setScore2(match.opponent2?.score ?? 0);
    setForfeit1(match.opponent1?.forfeit ?? false);
    setForfeit2(match.opponent2?.forfeit ?? false);
    setStatus(String(match.status ?? 3));
    setError('');
  }, [matchId, match]);

  if (!match || matchId === null) return null;

  const p1Name = getParticipantName(match.opponent1?.id);
  const p2Name = getParticipantName(match.opponent2?.id);
  const isBye = match.opponent1?.id === null || match.opponent2?.id === null;
  const canEdit = (match.status ?? 0) >= 2;

  const winner = score1 > score2 ? 'p1' : score2 > score1 ? 'p2' : forfeit1 ? 'p2' : forfeit2 ? 'p1' : null;

  const handleUpdate = async () => {
    setError('');
    if (!forfeit1 && !forfeit2 && score1 === score2 && status === '4') {
      setError('Scores must differ to complete a match (no ties allowed)');
      return;
    }
    setLoading(true);
    try {
      const completed = status === '4';
      await update.match({
        id: matchId,
        status: parseInt(status),
        opponent1: {
          score: score1,
          forfeit: forfeit1 || undefined,
          result: completed ? (winner === 'p1' ? 'win' : 'loss') : undefined,
        },
        opponent2: {
          score: score2,
          forfeit: forfeit2 || undefined,
          result: completed ? (winner === 'p2' ? 'win' : 'loss') : undefined,
        },
      });
      await refresh();
      toast('Match updated', 'success');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetLoading(true);
    try {
      await reset.matchResults(matchId);
      await refresh();
      toast('Match results reset', 'info');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Modal
      open={matchId !== null}
      onClose={onClose}
      title="Update Match"
      width={480}
      footer={
        <>
          {(match.status ?? 0) >= 4 && (
            <Button variant="danger" size="sm" loading={resetLoading} onClick={handleReset} style={{ marginRight: 'auto' }}>
              Reset Result
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleUpdate} disabled={!canEdit || isBye}>
            Save Result
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Match info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Match #{match.number}</span>
          <MatchStatusBadge status={match.status ?? 0} />
        </div>

        {isBye && (
          <div style={{ textAlign: 'center', padding: '12px', background: 'var(--amber-dim)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--amber)', fontSize: '13px' }}>
            This match has a BYE — no result needed
          </div>
        )}

        {!isBye && (
          <>
            {/* Score grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center', marginBottom: '8px', color: winner === 'p1' ? 'var(--green)' : 'var(--text-primary)' }}>
                  {p1Name}
                </div>
                <input
                  type="number"
                  min={0}
                  value={score1}
                  onChange={(e) => setScore1(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={!canEdit}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: '28px', fontWeight: 700,
                    background: winner === 'p1' ? 'var(--green-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${winner === 'p1' ? 'rgba(52,211,153,0.3)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--radius-md)', color: winner === 'p1' ? 'var(--green)' : 'var(--text-primary)',
                    padding: '12px', outline: 'none', fontFamily: 'var(--font-sans)',
                  }}
                />
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: 700, textAlign: 'center' }}>
                VS
              </div>

              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, textAlign: 'center', marginBottom: '8px', color: winner === 'p2' ? 'var(--green)' : 'var(--text-primary)' }}>
                  {p2Name}
                </div>
                <input
                  type="number"
                  min={0}
                  value={score2}
                  onChange={(e) => setScore2(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={!canEdit}
                  style={{
                    width: '100%', textAlign: 'center', fontSize: '28px', fontWeight: 700,
                    background: winner === 'p2' ? 'var(--green-dim)' : 'var(--bg-elevated)',
                    border: `1px solid ${winner === 'p2' ? 'rgba(52,211,153,0.3)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--radius-md)', color: winner === 'p2' ? 'var(--green)' : 'var(--text-primary)',
                    padding: '12px', outline: 'none', fontFamily: 'var(--font-sans)',
                  }}
                />
              </div>
            </div>

            {/* Forfeits */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={forfeit1} onChange={(e) => setForfeit1(e.target.checked)} disabled={!canEdit} />
                {p1Name} forfeits
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={forfeit2} onChange={(e) => setForfeit2(e.target.checked)} disabled={!canEdit} />
                {p2Name} forfeits
              </label>
            </div>

            {/* Status */}
            <Select
              label="Match status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={STATUS_OPTIONS}
              disabled={!canEdit}
            />

            {winner && status === '4' && (
              <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--green)', fontSize: '13px' }}>
                🏆 Winner: {winner === 'p1' ? p1Name : p2Name}
              </div>
            )}
          </>
        )}

        {error && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--red)', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
