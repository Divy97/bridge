# Bridge

Real-time text sharing application with end-to-end encryption.

## Features

- 🔐 **Encrypted Storage** - All text is encrypted before storing in the database
- ⚡ **Real-time Sync** - Changes sync instantly across all connected users
- 🎨 **Modern UI** - Built with Next.js 15, Tailwind CSS, and Shadcn/ui
- 🔥 **Firebase Backend** - Powered by Firestore for real-time updates

## Production Deployment Checklist

Before deploying to production, ensure the following:

### 1. Environment Variables

Set all required environment variables in your deployment platform (Vercel, etc.):

**Firebase Configuration:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

**Encryption Key (REQUIRED):**
- `NEXT_PUBLIC_ENCRYPTION_KEY` - Generate using: `openssl rand -base64 32`

⚠️ **Critical:** The encryption key must be:
- At least 32 characters long
- Randomly generated and kept secret
- Set in your production environment variables
- Never committed to version control

### 2. Firebase Setup

- [ ] Firestore database is enabled
- [ ] Anonymous authentication is enabled
- [ ] Firestore security rules are configured (see `firestore.rules`)
- [ ] Firebase project is linked to your deployment

### 3. Security

- [ ] All environment variables are set in production
- [ ] Encryption key is strong and randomly generated
- [ ] `.env.local` is in `.gitignore` (should already be)
- [ ] Firestore security rules are properly configured

### 4. Testing

- [ ] Test room creation
- [ ] Test text encryption/decryption
- [ ] Test real-time updates
- [ ] Verify encryption key error handling

## Development

See `apps/web/README.md` for development setup instructions.

## Deployment

This project is configured for Vercel deployment. The `vercel.json` file contains the build configuration.

For other platforms, ensure:
- Build command: `pnpm run build`
- Output directory: `apps/web/.next`
- Install command: `pnpm install --frozen-lockfile`
