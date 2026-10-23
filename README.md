# Sizzer — AI-Powered Full-Stack App Builder

![Sizzer preview](./public/goat.png)

Sizzer is an AI-powered development workspace for turning a plain-language idea into a working full-stack application. Describe the product you want, then let Sizzer plan, build, validate, preview, and iterate on it from one interface.

## What Makes Sizzer Different

Sizzer combines an AI coding workflow with a real project workspace rather than only generating a static mock-up.

- **Build from a conversation** — describe a website or app in everyday language and refine it through follow-up messages.
- **Full project workflow** — create projects, manage conversations, view live progress, inspect generated code, and preview the result.
- **AI agents with checks** — the build pipeline plans work, writes code, validates it, and checks that the result builds successfully.
- **Persistent workspace** — projects and chat history remain available, so you can continue where you left off.
- **Model selection** — choose an available AI provider/model for the task, or keep the automatic option selected.

Whether you are exploring a product idea, prototyping an interface, or building a production-ready web application, Sizzer is designed to keep the process fast and understandable.

## How It Works

1. Create a project and enter what you want to build.
2. Sizzer turns the request into a plan and code changes.
3. The agent pipeline validates the output and runs build checks.
4. Review the live preview or source code.
5. Continue the conversation to improve the application.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express, Prisma, PostgreSQL, Redis
- **AI workflow:** configurable model providers and multi-step agent pipeline
- **Real time:** WebSockets for build and progress updates

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm or npm
- PostgreSQL and Redis for the backend services

### Install

```bash
git clone https://github.com/Nitinref/seezer.ai.git
cd seezer.ai
npm install
```

### Configure environment variables

Create a local environment file from the provided example and add your database, Redis, authentication, and AI-provider credentials.

```bash
copy .env.example .env.local
```

For the backend, use `backend/.env.example` as the configuration reference.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tips for Better Results

- Be specific about the pages, features, users, and visual direction you want.
- Build the main flow first, then ask for smaller refinements.
- Review the generated plan before proceeding with a complex build.
- Keep related changes in one prompt to reduce back-and-forth.

## Contributing

Issues and improvements are welcome. Please open an issue or submit a pull request with a clear description of the change.
