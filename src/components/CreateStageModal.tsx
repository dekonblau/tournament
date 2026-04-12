import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Input';
import { useManager } from '../store/managerContext';
import { useToast } from './ui/index';
import type { StageType } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
}

const FORMAT_OPTIONS = [
  { value: 'single_elimination', label: 'Single Elimination' },
  { value: 'double_elimination', label: 'Double Elimination' },
  { value: 'round_robin', label: 'Round Robin' },
];

const GRAND_FINAL_OPTIONS = [
  { value: 'simple', label: 'Simple (1 match)' },
  { value: 'double', label: 'Double (best-of-2 bracket)' },
];

const SEED_ORDERING_OPTIONS = [
  { value: 'natural', label: 'Natural (1v2, 3v4…)' },
  { value: 'inner_outer', label: 'Inner/Outer (1v16, 2v15…)' },
  { value: 'reverse', label: 'Reverse' },
  { value: 'half_shift', label: 'Half Shift' },
  { value: 'pair_flip', label: 'Pair Flip' },
];

const RR_MODE_OPTIONS = [
  { value: 'simple', label: 'Single round-robin' },
  { value: 'double', label: 'Double round-robin (home & away)' },
];

function nextPow2(n: number) {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function CreateStageModal({ open, onClose, tournamentId }: Props) {
  const { create, refresh } = useManager();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<StageType>('single_elimination');
  const [participantsRaw, setParticipantsRaw] = useState('Team Alpha\nTeam Beta\nTeam Gamma\nTeam Delta\nTeam Epsilon\nTeam Zeta\nTeam Eta\nTeam Theta');
  const [grandFinal, setGrandFinal] = useState<'simple' | 'double'>('simple');
  const [consolationFinal, setConsolationFinal] = useState(false);
  const [matchesChildCount, setMatchesChildCount] = useState(0);
  const [seedOrdering, setSeedOrdering] = useState('inner_outer');
  const [balanceByes, setBalanceByes] = useState(true);
  const [rrMode, setRrMode] = useState<'simple' | 'double'>('simple');
  const [groupCount, setGroupCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const participants = participantsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  const isElim = type !== 'round_robin';

  // For elimination: pad to next power of 2
  let seeding: (string | null)[] = participants;
  let byeCount = 0;
  if (isElim && participants.length >= 2) {
    const size = nextPow2(participants.length);
    byeCount = size - participants.length;
    seeding = [...participants, ...Array(byeCount).fill(null)];
  }

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) return setError('Stage name is required');
    if (participants.length < 2) return setError('At least 2 participants required');
    if (isElim && participants.length < 2) return setError('Need at least 2 participants for elimination');

    setLoading(true);
    try {
      const settings: Record<string, unknown> = {};
      if (isElim) {
        settings.grandFinal = grandFinal;
        settings.consolationFinal = consolationFinal;
        settings.seedOrdering = [seedOrdering, 'natural'];
        settings.balanceByes = balanceByes;
      } else {
        settings.roundRobinMode = rrMode;
        settings.groupCount = groupCount;
      }
      if (matchesChildCount > 0) settings.matchesChildCount = matchesChildCount;

      await create.stage({
        name: name.trim(),
        tournamentId,
        type,
        seeding,
        settings,
      });

      await refresh();
      toast(`Stage "${name.trim()}" created`, 'success');
      onClose();
      // reset
      setName(''); setType('single_elimination');
      setParticipantsRaw('Team Alpha\nTeam Beta\nTeam Gamma\nTeam Delta\nTeam Epsilon\nTeam Zeta\nTeam Eta\nTeam Theta');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create stage');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Stage"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit}>Create Stage</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input
          label="Stage name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Grand Finals"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        />

        <Select
          label="Format"
          value={type}
          onChange={(e) => setType(e.target.value as StageType)}
          options={FORMAT_OPTIONS}
        />

        <Textarea
          label="Participants (one per line)"
          value={participantsRaw}
          onChange={(e) => setParticipantsRaw(e.target.value)}
          hint={
            isElim && participants.length >= 2
              ? `${participants.length} participants → padded to ${nextPow2(participants.length)} slots (${byeCount} BYEs added)`
              : `${participants.length} participant${participants.length !== 1 ? 's' : ''}`
          }
          style={{ minHeight: '120px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
        />

        {/* Elimination-specific settings */}
        {isElim && (
          <>
            <Select
              label="Seed ordering"
              value={seedOrdering}
              onChange={(e) => setSeedOrdering(e.target.value)}
              options={SEED_ORDERING_OPTIONS}
            />
            <Select
              label="Grand final format"
              value={grandFinal}
              onChange={(e) => setGrandFinal(e.target.value as 'simple' | 'double')}
              options={GRAND_FINAL_OPTIONS}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={consolationFinal} onChange={(e) => setConsolationFinal(e.target.checked)} />
              Include consolation final (3rd place match)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={balanceByes} onChange={(e) => setBalanceByes(e.target.checked)} />
              Balance BYEs (distribute evenly across bracket)
            </label>
          </>
        )}

        {/* Round robin settings */}
        {!isElim && (
          <>
            <Select
              label="Round-robin mode"
              value={rrMode}
              onChange={(e) => setRrMode(e.target.value as 'simple' | 'double')}
              options={RR_MODE_OPTIONS}
            />
            <Input
              label="Number of groups"
              type="number"
              value={groupCount}
              onChange={(e) => setGroupCount(Math.max(1, parseInt(e.target.value) || 1))}
              hint="Split participants into multiple round-robin groups"
            />
          </>
        )}

        {/* Match child count (best-of-N) */}
        <Input
          label="Best-of (match games per match, 0 = single match)"
          type="number"
          value={matchesChildCount}
          onChange={(e) => setMatchesChildCount(Math.max(0, parseInt(e.target.value) || 0))}
          hint="Set to 3 for best-of-3, 5 for best-of-5, etc."
        />

        {error && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--red)', fontSize: '13px' }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
