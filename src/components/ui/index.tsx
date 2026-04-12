import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

// ── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'accent' | 'green' | 'amber' | 'red' | 'blue' | 'muted';

const badgeColors: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default: { bg: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: 'var(--border)' },
  accent:  { bg: 'var(--accent-dim)', color: 'var(--accent-hover)', border: 'rgba(99,102,241,0.25)' },
  green:   { bg: 'var(--green-dim)',  color: 'var(--green)',         border: 'rgba(52,211,153,0.2)' },
  amber:   { bg: 'var(--amber-dim)',  color: 'var(--amber)',         border: 'rgba(251,191,36,0.2)' },
  red:     { bg: 'var(--red-dim)',    color: 'var(--red)',           border: 'rgba(248,113,113,0.2)' },
  blue:    { bg: 'var(--blue-dim)',   color: 'var(--blue)',          border: 'rgba(96,165,250,0.2)' },
  muted:   { bg: 'transparent',      color: 'var(--text-muted)',    border: 'var(--border)' },
};

export function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const c = badgeColors[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: '99px',
      padding: '2px 8px',
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.3px',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'border-color 0.15s, background 0.15s' : undefined,
        ...style,
      }}
      onMouseEnter={onClick ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)';
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elevated)';
      } : undefined}
      onMouseLeave={onClick ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)';
      } : undefined}
    >
      {children}
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
interface ToastContextValue { toast: (msg: string, type?: Toast['type']) => void; }

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const colors: Record<Toast['type'], string> = {
    success: 'var(--green)',
    error: 'var(--red)',
    info: 'var(--accent-hover)',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 2000, pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${colors[t.type]}33`,
            borderLeft: `3px solid ${colors[t.type]}`,
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: '13px',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)',
            maxWidth: '340px',
            animation: 'slideIn 0.2s ease',
          }}>
            <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }`}</style>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function Confirm({ open, title, message, onConfirm, onCancel, danger }: ConfirmProps) {
  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)', padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          width: '100%', maxWidth: 360,
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h3 style={{ marginBottom: '8px', color: danger ? 'var(--red)' : 'var(--text-primary)' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)' }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{ background: danger ? 'var(--red-dim)' : 'var(--accent)', color: danger ? 'var(--red)' : '#fff', border: danger ? '1px solid rgba(248,113,113,0.3)' : 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
interface TabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div style={{
      display: 'flex', gap: '2px',
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
      padding: '3px', width: 'fit-content',
    }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: 'calc(var(--radius-md) - 2px)',
            fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', border: 'none',
            fontFamily: 'var(--font-sans)',
            transition: 'all 0.15s',
            background: active === t.id ? 'var(--accent)' : 'transparent',
            color: active === t.id ? '#fff' : 'var(--text-muted)',
          }}
        >
          {t.icon}{t.label}
        </button>
      ))}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '1px',
      textTransform: 'uppercase', color: 'var(--text-muted)',
      marginBottom: '8px',
    }}>
      {children}
    </p>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style }: { style?: React.CSSProperties }) {
  return <div style={{ height: '1px', background: 'var(--border)', ...style }} />;
}

// ── Status badge for matches ──────────────────────────────────────────────────
const matchStatusVariant: Record<number, BadgeVariant> = {
  0: 'muted', 1: 'muted', 2: 'amber', 3: 'accent', 4: 'green', 5: 'default',
};
const matchStatusLabel: Record<number, string> = {
  0: 'Locked', 1: 'Waiting', 2: 'Ready', 3: 'Running', 4: 'Completed', 5: 'Archived',
};

export function MatchStatusBadge({ status }: { status: number }) {
  return <Badge variant={matchStatusVariant[status] ?? 'muted'}>{matchStatusLabel[status] ?? 'Unknown'}</Badge>;
}
