# TaskFlow

A local-first, keyboard-friendly personal task manager for Windows, built with Tauri 2, React,
TypeScript and SQLite. Everything stays on your PC and works offline.

**Status:** 1.0.0. See [RELEASE_NOTES.md](RELEASE_NOTES.md).

## Run and build

```powershell
npm install
npm run tauri dev      # development app
npm run check          # typecheck + lint + tests
npm run tauri build    # installers in src-tauri\target\release\bundle\
```

## Documentation

- Architecture: [docs/architecture.md](docs/architecture.md)
- Database: [docs/database.md](docs/database.md)
- Roadmap and what each phase delivered: [docs/roadmap.md](docs/roadmap.md)
- Manual test checklist: [docs/manual-test-checklist.md](docs/manual-test-checklist.md)
- Contributor and agent guide: [AGENTS.md](AGENTS.md)
