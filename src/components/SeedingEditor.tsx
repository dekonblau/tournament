import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { GripVertical, RotateCcw } from 'lucide-react';
import { useManager } from '../store/managerContext';
import { useToast } from './ui/index';
import type { Stage } from 'brackets-model';

interface Props {
  open: boolean;
  onClose: () => void;
  stage: Stage;
}

export function SeedingEditor({ open, onClose, stage }: Props) {
  const { get, update, reset, db, refresh } = useManager();
  const { toast } = useToast();

  const [seeding, setSeeding] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setFetching(true);
    get.seeding(stage.id).then((slots) => {
      setSeeding(
        slots.map((slot) => {
          if (slot === null) return null;
          const p = db.participant.find((p) => p.id === (slot as { id: number | null }).id);
          return p?.name ?? null;
        })
      );
    }).catch(() => {
      setSeeding([]);
    }).finally(() => setFetching(false));
  }, [open, stage.id, get, db.participant]);

  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setOverIdx(i); };
  const handleDrop = (i: number) => {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...seeding];
    const [item] = next.splice(dragIdx, 1);
    next.splice(i, 0, item);
    setSeeding(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await update.seeding(stage.id, seeding);
      await refresh();
      toast('Seeding updated', 'success');
      onClose();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to update seeding', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await reset.seeding(stage.id);
      await refresh();
      setSeeding(seeding.map(() => null));
      toast('Seeding reset to TBD', 'info');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to reset', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Seeding — ${stage.name}`}
      width={440}
      footer={
        <>
          <Button variant="ghost" icon={<RotateCcw size={13} />} onClick={handleReset} loading={loading}>Reset to TBD</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleSave}>Save Seeding</Button>
        </>
      }
    >
      {fetching ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading seeding…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Drag rows to reorder. Empty slots are <strong>TBD</strong> — they become BYEs when the tournament starts.
          </p>
          {seeding.map((name, i) => {
            const isTbd = !name;
            const bgColor = overIdx === i
              ? 'var(--accent-dim)'
              : dragIdx === i
              ? 'var(--bg-hover)'
              : isTbd
              ? 'rgba(245,158,11,0.06)'
              : 'var(--bg-overlay)';
            const borderColor = overIdx === i
              ? 'rgba(99,102,241,0.3)'
              : isTbd
              ? 'rgba(245,158,11,0.25)'
              : 'var(--border)';
            return (
              <div
                key={i}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px',
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'grab', transition: 'background 0.1s, border-color 0.1s',
                }}
              >
                <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', minWidth: 20 }}>#{i + 1}</span>
                <input
                  value={name ?? ''}
                  onChange={(e) => {
                    const next = [...seeding];
                    next[i] = e.target.value || null;
                    setSeeding(next);
                  }}
                  placeholder="TBD"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: name ? 'var(--text-primary)' : 'rgba(245,158,11,0.7)',
                    fontFamily: 'var(--font-sans)', fontSize: '13px',
                    fontStyle: name ? 'normal' : 'italic',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
