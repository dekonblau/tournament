import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Plus, Swords, Users, TrendingUp } from 'lucide-react';
import { useManager } from '../store/managerContext';
import { Card, Badge } from '../components/ui/index';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/index';

export function Dashboard() {
  const { tournaments, db, createTournament } = useManager();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleQuickCreate = () => {
    const name = `Tournament ${tournaments.length + 1}`;
    const t = createTournament(name);
    navigate(`/tournament/${t.id}`);
    toast(`Created "${name}"`, 'success');
  };

  const totalMatches = db.match.length;
  const completedMatches = db.match.filter((m) => (m.status ?? 0) >= 4).length;
  const totalParticipants = db.participant.length;
  const totalStages = db.stage.length;

  const recentStages = [...db.stage].reverse().slice(0, 5);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      {/* Hero */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ marginBottom: '6px' }}>Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your tournaments and brackets</p>
          </div>
          <Button variant="primary" icon={<Plus size={15} />} size="lg" onClick={handleQuickCreate}>
            New Tournament
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Tournaments', value: tournaments.length, icon: <Trophy size={18} />, color: 'var(--accent)' },
          { label: 'Stages', value: totalStages, icon: <Swords size={18} />, color: 'var(--blue)' },
          { label: 'Participants', value: totalParticipants, icon: <Users size={18} />, color: 'var(--green)' },
          { label: 'Matches played', value: `${completedMatches}/${totalMatches}`, icon: <TrendingUp size={18} />, color: 'var(--amber)' },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{stat.label}</span>
              <span style={{ color: stat.color, opacity: 0.8 }}>{stat.icon}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Tournaments list */}
        <div>
          <h2 style={{ marginBottom: '14px' }}>Tournaments</h2>
          {tournaments.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center' }}>
              <Trophy size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '13px' }}>No tournaments yet</p>
              <Button variant="primary" icon={<Plus size={14} />} onClick={handleQuickCreate}>Create your first</Button>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tournaments.map((t) => {
                const stageCount = db.stage.filter((s) => s.tournament_id === t.id).length;
                return (
                  <Card key={t.id} onClick={() => navigate(`/tournament/${t.id}`)} style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: '3px' }}>{t.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(t.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={stageCount > 0 ? 'accent' : 'muted'}>
                        {stageCount} stage{stageCount !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent stages */}
        <div>
          <h2 style={{ marginBottom: '14px' }}>Recent Stages</h2>
          {recentStages.length === 0 ? (
            <Card style={{ padding: '32px', textAlign: 'center' }}>
              <Swords size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No stages created yet</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentStages.map((s) => {
                const tournament = tournaments.find((t) => t.id === s.tournament_id);
                const matches = db.match.filter((m) => m.stage_id === s.id);
                const done = matches.filter((m) => (m.status ?? 0) >= 4).length;
                const pct = matches.length ? Math.round((done / matches.length) * 100) : 0;
                const typeLabel = s.type === 'single_elimination' ? 'SE' : s.type === 'double_elimination' ? 'DE' : 'RR';
                const typeVariant = s.type === 'single_elimination' ? 'green' : s.type === 'double_elimination' ? 'amber' : 'accent';
                return (
                  <Card key={s.id} onClick={() => tournament && navigate(`/tournament/${tournament.id}/stage/${s.id}`)} style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>{s.name}</div>
                      <Badge variant={typeVariant as 'green' | 'amber' | 'accent'}>{typeLabel}</Badge>
                    </div>
                    {tournament && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>{tournament.name}</div>}
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--bg-overlay)', borderRadius: 99 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: 99, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{done}/{matches.length}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
