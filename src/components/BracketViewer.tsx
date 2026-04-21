import { useEffect, useRef } from 'react';
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

      // Attach click handlers and inject match labels
      setTimeout(() => {
        if (!containerRef.current) return;

        // Build label map: matchId → "WB 1.1" / "LB 2.3" / "GF 1.1"
        const isDouble = stages.some(s => s.type === 'double_elimination');
        const sortedGroupIds = Array.from(new Set(matches.map(m => m.group_id as number))).sort((a, b) => a - b);
        const groupPrefix = (gid: number) => {
          if (!isDouble || sortedGroupIds.length === 1) return '';
          const idx = sortedGroupIds.indexOf(gid);
          if (idx === 0) return 'WB ';
          if (idx === sortedGroupIds.length - 1 && sortedGroupIds.length > 2) return 'GF ';
          return 'LB ';
        };
        const groupRounds = new Map<number, number[]>();
        for (const m of matches) {
          const gid = m.group_id as number;
          if (!groupRounds.has(gid)) groupRounds.set(gid, []);
          const arr = groupRounds.get(gid)!;
          if (!arr.includes(m.round_id as number)) arr.push(m.round_id as number);
        }
        groupRounds.forEach(arr => arr.sort((a, b) => a - b));
        const labelMap = new Map<number, string>();
        for (const m of matches) {
          const gid = m.group_id as number;
          const roundIdx = groupRounds.get(gid)!.indexOf(m.round_id as number) + 1;
          labelMap.set(m.id as number, `${groupPrefix(gid)}${roundIdx}.${m.number}`);
        }

        containerRef.current.querySelectorAll('.match').forEach((el) => {
          const matchId = parseInt((el as HTMLElement).dataset.matchId ?? '');
          if (isNaN(matchId)) return;

          if (onMatchClick) {
            (el as HTMLElement).style.cursor = 'pointer';
            (el as HTMLElement).onclick = () => onMatchClick(matchId);
          }

          const opponents = el.querySelector('.opponents') as HTMLElement | null;
          if (!opponents) return;

          // Re-use existing injected label or replace the native library span
          let label = opponents.querySelector('.bm-label') as HTMLElement | null;
          if (!label) {
            // Remove any native label span the library rendered (no class, direct child span)
            const nativeSpan = opponents.querySelector(':scope > span:not(.bm-label)') as HTMLElement | null;
            if (nativeSpan) nativeSpan.remove();
            label = document.createElement('span');
            label.className = 'bm-label';
            opponents.insertBefore(label, opponents.firstChild);
          }
          label.textContent = labelMap.get(matchId) ?? '';
        });

        // Inject TBD/BYE text for empty participant slots.
        // {id:null} TBD slots render blank; null BYE slots get "BYE" from the library
        // but in our dark theme the library's light-theme color makes it invisible.
        containerRef.current.querySelectorAll('.match').forEach((matchEl) => {
          const mid = parseInt((matchEl as HTMLElement).dataset.matchId ?? '');
          if (isNaN(mid)) return;
          const match = matches.find((m) => (m.id as number) === mid);
          if (!match) return;

          const participantEls = matchEl.querySelectorAll('.participant');
          const opps = [match.opponent1, match.opponent2] as (null | { id: number | null })[];

          participantEls.forEach((pEl, idx) => {
            if (idx >= 2) return;
            const opp = opps[idx];
            const nameEl = pEl.querySelector('.name') as HTMLElement | null;
            if (!nameEl) return;

            const isEmpty = !nameEl.textContent?.trim();
            const isByeClass = nameEl.classList.contains('bye');
            if (!isEmpty && !isByeClass) return;

            // Only label null opponents (true BYEs). {id:null} slots are locked
            // matches waiting for advancement — leave them blank so they don't
            // mislead as "TBD" (unassigned participant).
            const isBye = opp === null || isByeClass;
            if (!isBye) return;
            nameEl.textContent = 'BYE';
            nameEl.style.fontStyle = 'italic';
            nameEl.style.opacity = '0.65';
          });
        });
      }, 50);
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
