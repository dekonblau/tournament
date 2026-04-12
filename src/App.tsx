import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { TournamentPage } from './pages/TournamentPage';
import { StagePage } from './pages/StagePage';
import { ToastProvider } from './components/ui/index';
import { ServerStatus } from './components/ServerStatus';

export default function App() {
  return (
    <ToastProvider>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <ServerStatus />
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
