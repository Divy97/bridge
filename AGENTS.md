# Agent Guidelines for Bridge

Agentic coding instructions for this repository. This is a Next.js 16 monorepo with Firebase Functions.

## Project Structure

```
bridge/
├── apps/
│   └── web/           # Next.js 16 web application
├── packages/
│   └── functions/     # Firebase Cloud Functions
├── .cursor/rules/     # Cursor IDE rules
└── package.json       # Root monorepo configuration (pnpm + Turbo)
```

## Build Commands

From root:
- `pnpm dev` - Start dev server (filtered to web app via Turbo)
- `pnpm build` - Build for production
- `pnpm test` - Run tests (not yet configured)

From apps/web:
- `pnpm dev` - Start Next.js dev server
- `pnpm build` - Build Next.js app
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

From packages/functions:
- `pnpm build` - Compile TypeScript
- `pnpm serve` - Run Firebase emulators
- `pnpm deploy` - Deploy to Firebase

## Code Style

### TypeScript
- **Strict mode enabled** - must satisfy all strict checks
- Target: ES2017, Module: ESNext, ModuleResolution: bundler
- Use explicit return types on exported functions
- Define interfaces/types for complex objects

### Imports
- Use path alias `@/*` for src/ imports
- Group imports: React → External libs → Internal (@/)
- Example: `import { Button } from "@/components/ui/button"`

### Naming Conventions
- **Components**: PascalCase (`CreateRoomDialog`)
- **Functions/Variables**: camelCase (`handleSubmit`, `roomData`)
- **Interfaces**: PascalCase with descriptive names
- **Event Handlers**: prefix with `handle` (`handleClick`, `handleSubmit`)
- **Private**: underscore prefix for unused params (`_error`)

### Formatting
- 2 spaces indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 (implied)

### Components
- Use `'use client'` directive for client components
- Server components by default (Next.js 16 App Router)
- Shadcn/ui components from `@/components/ui/*`
- Utility function `cn()` from `@/lib/utils` for class merging

### Styling
- **Tailwind CSS only** - no CSS files
- Use `class:` instead of ternary for conditional classes
- Prefer composition over complex conditionals
- Lucide React for icons

### Patterns
- **Early returns** - prefer guard clauses over nested if/else
- **DRY** - extract shared logic to hooks/utils
- **Error handling** - use try/catch with proper error messages
- **Accessibility** - include tabindex, aria-label, semantic HTML

### Functions
- Prefer `const` arrow functions over `function` keyword
- Example: `const handler = async () => { ... }`

### Error Handling
- Try/catch blocks for async operations
- Proper error messages for user feedback (toast/sonner)
- Log errors appropriately for debugging

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **React**: v19.2+ with React Server Components
- **TypeScript**: v5.x (strict mode)
- **Styling**: Tailwind CSS v4, shadcn/ui, Radix UI
- **State**: React hooks (useState, useEffect)
- **Backend**: Firebase (Auth, Firestore, Storage, Functions)
- **Icons**: Lucide React
- **Monorepo**: pnpm workspaces + Turbo

## File Locations

- Components: `apps/web/src/components/ui/` (shadcn), `apps/web/src/components/`
- Utilities: `apps/web/src/lib/`
- Hooks: `apps/web/src/hooks/`
- Types: Co-located or `apps/web/src/types/`
- Pages: `apps/web/src/app/` (App Router)

## Before Committing

1. Run `pnpm lint` from apps/web - fix any ESLint errors
2. Ensure TypeScript compiles without errors
3. Test in both light and dark modes (next-themes)
4. Verify responsive design (mobile-first Tailwind)

## Notes

- No test framework configured yet (Jest/Vitest/Cypress TBD)
- Firebase emulators available for local backend development
- Dark mode support via next-themes (class-based)
