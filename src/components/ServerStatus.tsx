import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

type Status = 'checking' | 'ok' | 'error';

export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('/api/export', { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (!cancelled) setStatus(res.ok ? 'ok' : 'error');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    check();
    // Re-check every 30 s
    const interval = setInterval(check, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Auto-hide the "ok" banner after 3 seconds
  useEffect(() => {
    if (status !== 'ok') return;
    const t = setTimeout(() => setDismissed(true), 3000);
    return () => clearTimeout(t);
  }, [status]);

  if (status === 'checking') {
    return (
      <div style={bannerStyle('var(--bg-elevated)', 'var(--border)')}>
        <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--text-muted)' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Connecting to API server…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={bannerStyle('rgba(248,113,113,0.08)', 'rgba(248,113,113,0.2)')}>
        <AlertTriangle size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
        <span style={{ color: 'var(--red)', fontSize: '12px', flex: 1 }}>
          <strong>API server not reachable.</strong> Run{' '}
          <code style={{ background: 'rgba(248,113,113,0.15)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>
            npm run dev:server
          </code>{' '}
          or{' '}
          <code style={{ background: 'rgba(248,113,113,0.15)', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>
            npm run dev:all
          </code>
        </span>
      </div>
    );
  }

  if (status === 'ok' && !dismissed) {
    return (
      <div style={bannerStyle('rgba(52,211,153,0.08)', 'rgba(52,211,153,0.2)')}>
        <CheckCircle2 size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
        <span style={{ color: 'var(--green)', fontSize: '12px' }}>Connected to API server</span>
      </div>
    );
  }

  return null;
}

function bannerStyle(bg: string, border: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px',
    background: bg,
    borderBottom: `1px solid ${border}`,
    flexShrink: 0,
  };
}
