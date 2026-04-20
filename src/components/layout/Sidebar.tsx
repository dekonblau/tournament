import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy, LayoutDashboard, Users, Swords, BarChart2,
  Settings, ChevronRight, Plus, Trash2, Download, Upload,
} from 'lucide-react';
import { useManager } from '../../store/managerContext';
import { useToast, Confirm, SectionLabel } from '../ui/index';
import { Button } from '../ui/Button';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { tournaments, db, createTournament, deleteTournament, exportData, importData, refresh } = useManager();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [newTournamentName, setNewTournamentName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const activeTournamentId = location.pathname.match(/\/tournament\/(\d+)/)?.[1];

  const handleCreate = () => {
    const name = newTournamentName.trim();
    if (!name) return;
    const t = createTournament(name);
    setNewTournamentName('');
    setShowInput(false);
    navigate(`/tournament/${t.id}`);
    toast(`Tournament "${name}" created`, 'success');
  };

  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bracket-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Data exported', 'success');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importData(data);
        toast('Data imported successfully', 'success');
      } catch {
        toast('Failed to import — invalid file', 'error');
      }
    };
    input.click();
  };

  const stageCountForTournament = (id: number) =>
    db.stage.filter((s) => s.tournament_id === id).length;

  return (
    <>
      <Confirm
        open={deleteTarget !== null}
        title="Delete tournament?"
        message="This will permanently delete all stages, matches, and results. This cannot be undone."
        danger
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await deleteTournament(deleteTarget);
            toast('Tournament deleted', 'info');
            if (activeTournamentId && Number(activeTournamentId) === deleteTarget) navigate('/');
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <aside
        className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}
        style={{
          width: collapsed ? 56 : 240,
          minWidth: collapsed ? 56 : 240,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s, min-width 0.2s, transform 0.25s',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #818cf8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Trophy size={14} color="#fff" />
          </div>
          {!collapsed && (
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              Bracket Manager
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', display: 'flex',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s',
              flexShrink: 0,
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
          {/* Nav */}
          <NavItem icon={<LayoutDashboard size={15} />} label="Dashboard" to="/" collapsed={collapsed} active={location.pathname === '/'} onNavigate={onMobileClose} />

          {/* Tournaments */}
          {!collapsed && (
            <div style={{ marginTop: '16px', marginBottom: '4px', paddingLeft: '8px' }}>
              <SectionLabel>Tournaments</SectionLabel>
            </div>
          )}

          {tournaments.map((t) => (
            <div
              key={t.id}
              style={{ position: 'relative' }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget.querySelector<HTMLButtonElement>('.del-btn');
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget.querySelector<HTMLButtonElement>('.del-btn');
                if (btn) btn.style.opacity = '0';
              }}
            >
              <NavItem
                icon={<Trophy size={15} />}
                label={`${t.name}${stageCountForTournament(t.id) ? ` (${stageCountForTournament(t.id)})` : ''}`}
                to={`/tournament/${t.id}`}
                collapsed={collapsed}
                active={activeTournamentId === String(t.id)}
                onNavigate={onMobileClose}
              />
              {!collapsed && (
                <button
                  className="del-btn"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(t.id); }}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', opacity: 0, transition: 'opacity 0.15s, color 0.15s',
                    display: 'flex', padding: '2px',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                  title="Delete tournament"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}

          {/* Add tournament */}
          {!collapsed && (
            showInput ? (
              <div style={{ padding: '4px 6px', display: 'flex', gap: '4px', marginTop: '2px' }}>
                <input
                  autoFocus
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowInput(false); setNewTournamentName(''); } }}
                  placeholder="Tournament name"
                  style={{
                    flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                    padding: '6px 8px', fontSize: '12px', outline: 'none', fontFamily: 'var(--font-sans)',
                  }}
                />
                <button onClick={handleCreate} style={{ background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '6px 8px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>Add</button>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
                  padding: '7px 10px', background: 'none', border: '1px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '12px', marginTop: '4px', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                }}
              >
                <Plus size={12} /> New tournament
              </button>
            )
          )}
        </div>

        {/* Footer actions */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px' }}>
          {collapsed ? (
            <>
              <IconBtn icon={<Download size={15} />} onClick={handleExport} title="Export data" />
              <IconBtn icon={<Upload size={15} />} onClick={handleImport} title="Import data" />
            </>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={handleExport} style={{ flex: 1, justifyContent: 'center' }}>Export</Button>
              <Button variant="ghost" size="sm" icon={<Upload size={13} />} onClick={handleImport} style={{ flex: 1, justifyContent: 'center' }}>Import</Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function NavItem({ icon, label, to, collapsed, active, onNavigate }: { icon: React.ReactNode; label: string; to: string; collapsed: boolean; active: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => { navigate(to); onNavigate?.(); }}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
        padding: collapsed ? '8px' : '7px 10px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active ? 'var(--accent-dim)' : 'none',
        border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--accent-hover)' : 'var(--text-secondary)',
        cursor: 'pointer', fontSize: '13px', fontWeight: active ? 500 : 400,
        fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden',
        transition: 'all 0.12s', marginBottom: '1px',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
    >
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
    </button>
  );
}

function IconBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', padding: '8px', background: 'none', border: 'none',
        borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
        cursor: 'pointer', transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
    >
      {icon}
    </button>
  );
}
