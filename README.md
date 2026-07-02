# Builder OS

macOS AI Product Development Operating System — a local-first desktop app that orchestrates the full product lifecycle from idea to release.

## Stack

- **Desktop:** Tauri v2 (Rust)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Database:** SQLite (local)
- **Secrets:** macOS Keychain
- **Integrations:** OpenAI, Cursor, Figma, GitHub, Notion

## Prerequisites

- macOS
- Rust toolchain (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node.js v20+
- pnpm (`npm install -g pnpm`)
- Xcode Command Line Tools

## Development

```bash
cd builder-os
pnpm install
pnpm tauri dev
```

## Build

```bash
pnpm tauri build
```

## Features

- Project creation wizard (10 steps)
- Product Brain — single source of truth
- Product lifecycle workflow (10 stages)
- AI deliverable generation (8 agents)
- Cursor integration (rules, tasks, open in Cursor)
- GitHub issue creation from user stories
- Notion documentation sync
- Figma design context reader
- QA and release readiness
- Approval gates for external actions
- Activity log

## Project Structure

```
src/
├── app/           # Router, layout
├── components/ui/ # shadcn/ui components
├── features/      # Feature modules
├── lib/           # Tauri command wrappers
├── stores/        # Zustand stores
└── types/         # TypeScript types

src-tauri/
├── src/commands/  # Rust Tauri commands
└── src/db/        # SQLite schema
```
