# Bracket Manager

A full-featured React + Vite frontend for [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js), with a **SQLite-backed Express API** for persistent storage.

## Architecture

```
┌─────────────────────────────────┐   HTTP/JSON   ┌──────────────────────────────┐
│  React + Vite (port 5173)       │ ◄───────────► │  Express API (port 3001)     │
│  src/                           │               │  server/                     │
│  ├── api/client.ts  (fetch)     │               │  ├── index.ts  (routes)      │
│  └── store/managerContext.tsx   │               │  └── SqliteStorage.ts        │
└─────────────────────────────────┘               │       brackets-manager       │
                                                  │       better-sqlite3         │
                                                  │       brackets.db ← file     │
                                                  └──────────────────────────────┘
```

- **brackets-manager** runs entirely server-side — never bundled into the browser
- **SQLite** persists all data in `brackets.db` — survives restarts and page reloads
- Vite **proxies** `/api/*` to Express in dev — no CORS config needed
- **brackets-viewer** loads from jsDelivr CDN at runtime (it has a real browser bundle)

## Quick Start

```bash
npm install
npm run dev:all      # starts Express (3001) + Vite (5173) together
```

Open http://localhost:5173

Or separately:
```bash
npm run dev:server   # Express + SQLite only
npm run dev          # Vite only
```

## Environment Variables

Copy `.env.example` to `.env`:

```env
PORT=3001
DB_PATH=./brackets.db
VITE_API_URL=           # empty = use Vite proxy in dev
```

## Full API via useManager()

```tsx
const {
  create,   // create.stage(input)
  update,   // update.match / .seeding / .matchGame / .roundOrdering / .matchChildCount / .confirmSeeding
  find,     // find.match / .matchGame / .nextMatches / .previousMatches / .upperBracket / .loserBracket
  get,      // get.stageData / .seeding / .finalStandings / .currentMatches / .currentRound / .currentStage
  reset,    // reset.matchResults / .matchGameResults / .seeding
  delete,   // delete.stage / .tournament
  exportData, importData,
  db,       // reactive snapshot: { stage[], match[], participant[], round[], group[], match_game[] }
  refresh,  // re-fetches db snapshot from server
} = useManager();
```

## Project Structure

```
bracket-manager/
├── server/
│   ├── index.ts            # Express routes
│   └── SqliteStorage.ts    # CrudInterface for better-sqlite3
├── src/
│   ├── api/client.ts       # Typed fetch wrappers
│   ├── store/managerContext.tsx
│   ├── components/
│   └── pages/
├── vite.config.ts          # Proxies /api → :3001 in dev
├── tsconfig.json
└── tsconfig.server.json
```

## Swapping Storage Backends

Implement these six methods from `CrudInterface` in a new class:
`insert`, `select`, `selectFirst`, `selectAll`, `update`, `delete`

Then swap in `server/index.ts`:
```ts
const storage = new YourStorage(...);
const manager = new BracketsManager(storage);
```

## Tech Stack

- Vite 5 + React 18 + TypeScript + React Router v6
- Express 4 + better-sqlite3
- brackets-manager (server-side), brackets-viewer (CDN)
- lucide-react, concurrently
