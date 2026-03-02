# Seezer.ai

> **AI-powered website builder** — describe what you want, get a production-ready React app.

Seezer.ai converts plain English prompts into fully functional, build-verified React applications using a multi-agent pipeline, isolated sandbox execution, and real-time streaming.

---

## What It Does

Type a prompt like *"Build a SaaS landing page with a hero section, pricing cards, and CTA"* — Seezer.ai plans, builds, validates, and verifies a complete React project, ready to deploy.

- Generates complete React applications from natural language
- Runs code safely inside isolated E2B sandboxes
- Streams live build logs via WebSockets
- Verifies production builds automatically before marking them ready
- Persists project state and chat history across sessions

---

## Architecture

```
User Prompt
     │
     ▼
API Server (Express)
     │
     ▼
Redis Queue
     │
     ▼
Worker Process
     │
     ▼
Agent Pipeline
  ├── PlannerAgent       — Analyzes context, generates structured build plan
  ├── BuilderAgent       — Creates/modifies React components and routing
  ├── CodeValidatorAgent — Fixes imports, syntax errors, dependencies
  └── AppCheckerAgent    — Runs npm build + lint, fixes compilation errors
     │
     ▼
E2B Sandbox (isolated execution)
     │
     ▼
WebSocket Live Logs  →  Database (PostgreSQL)
```

---

## Multi-Agent Pipeline

| Agent | Responsibility |
|---|---|
| **PlannerAgent** | Reads existing project files, generates a structured build plan, decides which files to create or modify |
| **BuilderAgent** | Writes React components, manages routing, uses sandbox tools for file operations |
| **CodeValidatorAgent** | Detects broken imports, fixes syntax errors, ensures dependency correctness |
| **AppCheckerAgent** | Runs `npm run build`, fixes compilation errors, executes linting, confirms production readiness |

Each agent operates with tool-based AI reasoning — not just text generation.

---

## Tech Stack

**Backend:** Node.js, Express, Redis, PostgreSQL, Prisma ORM, JWT Auth

**AI & Execution:** OpenAI Agent SDK, E2B Sandbox, structured prompt engineering

**Real-Time:** WebSockets for live build log streaming

---

## Getting Started

### Prerequisites

- Node.js + pnpm
- Docker (for PostgreSQL and Redis)
- OpenAI API key
- E2B API key

### 1. Clone

```bash
git clone https://github.com/yourusername/seezer-ai.git
cd seezer-ai
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

Create a `.env` file:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/postgres
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret
OPENAI_API_KEY=your_openai_key
E2B_API_KEY=your_e2b_key
E2B_TEMPLATE_ID=code-interpreter-v1
```

### 4. Start infrastructure

```bash
# PostgreSQL
docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres

# Redis
docker run -p 6379:6379 redis
```

### 5. Run

```bash
pnpm dev
```

---

## How a Build Works

1. User submits a prompt via the API
2. Job is pushed to Redis and picked up by a worker
3. Agent pipeline executes inside an E2B sandbox
4. Build logs stream to the client via WebSocket in real time
5. Final build is verified — project marked ready and state saved to PostgreSQL

---

## Key Design Decisions

**Incremental updates** — agents read existing project files before making changes, preserving context across edits.

**Sandboxed execution** — all code runs inside E2B, never on the host.

**Automated build verification** — `AppCheckerAgent` runs `npm run build` and lint on every generation. Projects are only marked ready when the build passes.

**Redundancy prevention** — the pipeline detects and skips unnecessary package installs.

**Persistent memory** — project context is stored between sessions so follow-up prompts build on prior work.

---

## Security

- All code execution is sandboxed via E2B — no arbitrary host access
- JWT-based authentication on all endpoints
- Tool invocations are controlled and scoped
- Build verification runs before any project is marked deployable

---

## Roadmap

- [ ] Versioned project snapshots
- [ ] One-click deployment (Vercel / Netlify integration)
- [ ] Persistent vector memory for long-term context
- [ ] Prompt template library
- [ ] Rate limiting and billing system

---

## Author

**Nitin Yadav** — B.Tech CSE, Backend & AI Systems Engineer

Built with a focus on real infrastructure: distributed job processing, multi-agent orchestration, secure sandbox execution, and production build automation.
