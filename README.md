# Bridge

**Instant, encrypted text and file sharing.** No accounts. No hassle. Just share.

[Live Demo](https://bridgee.vercel.app)

## What is it?

Bridge lets you create a room, share the link, and instantly collaborate with anyone. Everything is end-to-end encrypted and auto-deletes after 30 minutes.

## Features

- **Real-time sync** – See changes instantly across all devices
- **End-to-end encryption** – Your data is encrypted before it hits the server
- **File sharing** – Images, PDFs, text files up to 500KB (stored as Base64 in Firestore)
- **No sign-up required** – Anonymous rooms, instant access
- **Auto-cleanup** – Rooms and files deleted after 30 minutes

## Tech Stack

- Next.js 16 + React 19
- TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Firebase (Firestore, Auth)
- AES-256-GCM encryption

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.local.example apps/web/.env.local
# Edit apps/web/.env.local with your Firebase config

# Run dev server
pnpm dev
```

## Environment Variables

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Encryption (generate with: openssl rand -base64 32)
NEXT_PUBLIC_ENCRYPTION_KEY=
```

## Deployment

Configured for Vercel. Push to deploy:

```bash
vercel --prod
```

## License

MIT
