<!-- 6a7cb894-bbf7-483c-b6cc-cf74d35d2e3e 3b41c37e-369e-49ff-aad0-826fe16f59eb -->
# Bridge: Real-Time Text Sharing Implementation Plan

## Architecture Overview

**Monorepo Structure (Turborepo + pnpm):**
- `apps/web` - Next.js 15 frontend
- `packages/functions` - Firebase Cloud Functions
- `packages/shared` - Shared types and utilities

**Tech Stack:**
- Next.js 15 (React 19), Tailwind CSS, Shadcn/ui
- Firebase (Firestore, Anonymous Auth, Cloud Functions)
- Operational Transformation library (e.g., `ot.js` or `sharedb`)
- Deployment: Vercel (frontend) + Firebase (functions)

## Implementation Steps

### 1. Monorepo & Project Initialization

Initialize Turborepo with pnpm workspaces:
- Create root `package.json` with Turborepo configuration
- Set up `pnpm-workspace.yaml`
- Create `turbo.json` for build pipeline
- Initialize Next.js 15 app in `apps/web`
- Create `packages/shared` for TypeScript types
- Create `packages/functions` for Firebase Cloud Functions

### 2. Firebase Project Setup

- Create Firebase project in console
- Enable Firestore database
- Enable Anonymous Authentication
- Install Firebase SDKs in `apps/web`
- Create `apps/web/lib/firebase.ts` with Firebase config
- Add Firebase credentials to `.env.local`

### 3. Tailwind CSS & Shadcn/ui Setup

Install and configure in `apps/web`:
- Initialize Tailwind CSS
- Initialize Shadcn/ui
- Install components: Button, Input, Textarea, Card, Toast, Loader (lucide-react)

### 4. Operational Transformation Integration

- Choose and install OT library (recommend `ot.js` for text)
- Create `apps/web/lib/ot-client.ts` wrapper
- Implement OT adapter for Firebase Firestore
- Store operations history in Firestore subcollection: `/rooms/{roomCode}/operations/{opId}`

**Firestore Schema:**
```
/rooms/{roomCode}
  - text: string (current text state)
  - version: number (operation version counter)
  - lastUpdatedAt: timestamp
  - createdAt: timestamp

/rooms/{roomCode}/operations/{opId}
  - op: array (OT operation)
  - version: number
  - timestamp: timestamp
```

### 5. Room Code Generation

Create `apps/web/lib/room-code.ts`:
- Generate random 4-letter codes (A-Z)
- Check Firestore for uniqueness before creating room
- Retry generation if collision occurs

### 6. Home Page UI (`apps/web/app/page.tsx`)

Build landing page with:
- Hero section with app description
- "Create New Room" button → generates code, creates Firestore doc, redirects
- "Join Room" section with Input + Button
- Basic layout using Shadcn Card components

### 7. Room Page (`apps/web/app/[roomCode]/page.tsx`)

Dynamic route implementation:
- Fetch room document from Firestore
- Handle "Room not found" state
- Display room code with "Copy" button
- Main Textarea with OT sync
- "Copy Text" button
- Loading/connecting state indicators
- Real-time presence indicator (optional: show connected users count)

### 8. Real-Time Sync with OT

Create `apps/web/hooks/useOTSync.ts`:
- Subscribe to Firestore room document
- Initialize OT client with current text and version
- On local text change: generate OT operation, optimistically apply, send to Firestore
- On remote operation received: transform against pending operations, apply to local state
- Handle operation acknowledgments and conflict resolution

### 9. Firebase Service Layer

Create `apps/web/lib/firebase-service.ts`:
- `signInAnonymouslyIfNeeded()` - auto sign-in on app load
- `createRoom(text = '')` - generate code, create Firestore doc with initial state
- `getRoom(roomCode)` - fetch room document
- `updateRoomText(roomCode, operation, version)` - apply OT operation
- `deleteRoom(roomCode)` - cleanup function

### 10. Firestore Security Rules

Write `firestore.rules`:
- Allow anonymous users to read any room
- Allow anonymous users to write to rooms (public collaborative editing)
- Validate operation structure
- (Future: track room creators and add ownership rules)

### 11. Cleanup Cloud Function

Create `packages/functions/src/index.ts`:
- Scheduled function (runs hourly via cron: `0 * * * *`)
- Query rooms where `lastUpdatedAt < now() - 5 hours`
- Batch delete stale rooms and their operations subcollections
- Configure Firebase Functions deployment

### 12. Polish & Features

- Implement copy-to-clipboard with toast notifications
- Add keyboard shortcuts (Ctrl+C for copy, etc.)
- Responsive mobile design
- Error boundaries and loading states
- Add meta tags for SEO and sharing

### 13. Deployment

- Connect `apps/web` to Vercel
- Set up environment variables in Vercel
- Deploy Firestore rules: `firebase deploy --only firestore:rules`
- Deploy Cloud Functions: `firebase deploy --only functions`
- Test end-to-end functionality

## Key Files to Create

- `turbo.json`, `pnpm-workspace.yaml`
- `apps/web/lib/firebase.ts`, `apps/web/lib/firebase-service.ts`
- `apps/web/lib/room-code.ts`
- `apps/web/lib/ot-client.ts`, `apps/web/hooks/useOTSync.ts`
- `apps/web/app/page.tsx`, `apps/web/app/[roomCode]/page.tsx`
- `packages/shared/types.ts`
- `packages/functions/src/index.ts`
- `firestore.rules`

## Notes

- OT implementation is complex; consider starting with simpler last-write-wins, then upgrade to OT
- 4-letter codes = 456,976 combinations (26^4), reasonable for small-medium scale
- Monitor Firestore costs; each keystroke could trigger operations
- Consider rate limiting to prevent abuse

### To-dos

- [ ] Initialize Turborepo monorepo with pnpm workspaces, create apps/web, packages/shared, packages/functions
- [ ] Set up Next.js 15 app with TypeScript in apps/web
- [ ] Create Firebase project, enable Firestore and Anonymous Auth, configure in apps/web
- [ ] Install and configure Tailwind CSS and Shadcn/ui components
- [ ] Create room code generation utility (4 random letters with uniqueness check)
- [ ] Build Firebase service layer with room CRUD operations and anonymous auth
- [ ] Integrate Operational Transformation library and create Firestore adapter
- [ ] Create landing page with Create Room and Join Room functionality
- [ ] Create dynamic room page with real-time synced textarea using OT
- [ ] Create scheduled Cloud Function to delete rooms inactive for 5+ hours
- [ ] Write and deploy Firestore security rules for public read/write access
- [ ] Add copy buttons, toast notifications, responsive design, and loading states
- [ ] Deploy frontend to Vercel and Cloud Functions to Firebase