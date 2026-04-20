import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Menu, Trophy } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { TournamentPage } from './pages/TournamentPage';
import { StagePage } from './pages/StagePage';
import { ToastProvider } from './components/ui/index';
import { ServerStatus } from './components/ServerStatus';

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <ServerStatus />
        <div className="app-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {navOpen && <div className="mobile-overlay" onClick={() => setNavOpen(false)} />}
          <Sidebar mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
          <main className="app-main" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="mobile-header">
              <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <span className="mobile-title">
                <Trophy size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Bracket Manager
              </span>
            </div>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tournament/:tournamentId" element={<TournamentPage />} />
              <Route path="/tournament/:tournamentId/stage/:stageId" element={<StagePage />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
