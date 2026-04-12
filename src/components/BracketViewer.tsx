import React, { useEffect, useRef } from 'react';
import type { Stage, Match, MatchGame, Participant } from 'brackets-model';

interface BracketViewerProps {
  stages: Stage[];
  matches: Match[];
  matchGames: MatchGame[];
  participants: Participant[];
  onMatchClick?: (matchId: number) => void;
}

// brackets-viewer attaches itself to window
declare global {
  interface Window {
    bracketsViewer: {
      render: (data: {
        stages: Stage[];
        matches: Match[];
        matchGames: MatchGame[];
        participants: Participant[];
      }, options?: { selector?: string; clear?: boolean; participantOriginPlacement?: string }) => void;
    };
  }
}

let viewerLoaded = false;

// async function loadViewer(): Promise<void> {
//   if (viewerLoaded || window.bracketsViewer) { viewerLoaded = true; return; }
//   return new Promise((resolve, reject) => {
//     const script = document.createElement('script');
//     script.src = 'https://cdn.jsdelivr.net/npm/brackets-viewer@latest/dist/brackets-viewer.min.js';
//     script.onload = () => { viewerLoaded = true; resolve(); };
//     script.onerror = reject;
//     document.head.appendChild(script);
//   });
// }

async function loadViewer(): Promise<void> {
  if (viewerLoaded || window.bracketsViewer) { viewerLoaded = true; return; }

  // Inject CSS if not already present
  if (!document.querySelector('link[data-brackets-viewer]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/brackets-viewer@latest/dist/brackets-viewer.min.css';
    link.setAttribute('data-brackets-viewer', '');
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/brackets-viewer@latest/dist/brackets-viewer.min.js';
    script.onload = () => { viewerLoaded = true; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

let instanceCounter = 0;

export function BracketViewer({ stages, matches, matchGames, participants, onMatchClick }: BracketViewerProps) {
  const idRef = useRef(`bv-${++instanceCounter}`);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stages.length) return;

    loadViewer().then(() => {
      if (!window.bracketsViewer || !containerRef.current) return;

      window.bracketsViewer.render(
        { stages, matches, matchGames, participants },
        { selector: `#${idRef.current}`, clear: true }
      );

      // Attach click handlers to rendered match elements
      if (onMatchClick) {
        setTimeout(() => {
          containerRef.current?.querySelectorAll('.match').forEach((el) => {
            const matchId = parseInt((el as HTMLElement).dataset.matchId ?? '');
            if (!isNaN(matchId)) {
              (el as HTMLElement).style.cursor = 'pointer';
              (el as HTMLElement).onclick = () => onMatchClick(matchId);
            }
          });
        }, 50);
      }
    }).catch(() => {
      console.error('Failed to load brackets-viewer from CDN');
    });
  }, [stages, matches, matchGames, participants, onMatchClick]);

  if (!stages.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.3 }}>🏆</div>
        <p>No bracket to display</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id={idRef.current}
      className="brackets-viewer"
      style={{ overflowX: 'auto', padding: '8px' }}
    />
  );
}
