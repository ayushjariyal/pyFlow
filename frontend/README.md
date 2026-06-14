# Job Platform — Frontend (Phase 4)

A React + TypeScript dashboard for submitting and monitoring jobs, talking to the
FastAPI backend.

## Stack

- React 18 + TypeScript + Vite
- React Router (3 routes)
- Axios (centralized client in `src/services/api.ts`)
- Tailwind CSS
- Polling every 5s for live status (no WebSockets)

## Structure

```
frontend/src/
├── pages/
│   ├── Dashboard.tsx     # /        submit jobs (typed payload or CSV upload)
│   ├── JobsList.tsx      # /jobs    table + search / status filter / sort
│   └── JobDetails.tsx    # /jobs/:id  full job, result, retry on failure
├── components/           # StatusBadge, JobForm, Navbar, Layout, ErrorMessage, Spinner
├── hooks/                # useJobs / useJob (5s polling)
├── services/api.ts       # Axios client + typed endpoint wrappers + error mapping
├── types/job.ts          # TypeScript interfaces mirroring the API
└── utils/format.ts       # date / duration helpers
```

## Run it

The backend must be running first (API on http://localhost:8000, plus Redis +
the Celery worker — see the backend README).

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

To point at a non-default backend, create `.env`:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Notes

- **CORS:** the backend allows `http://localhost:5173` by default
  (`CORS_ORIGINS` in `backend/app/core/config.py`). If you run the dev server on
  a different port, add it there.
- `npm run build` does a strict type-check (`tsc -b`) then a production build into
  `dist/`. `npm run lint` runs the type-check only.
