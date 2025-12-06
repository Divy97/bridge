# Bridge

Real-time text sharing application with end-to-end encryption.

## Features

- 🔐 **Encrypted Storage** - All text is encrypted before storing in the database
- ⚡ **Real-time Sync** - Changes sync instantly across all connected users
- 📎 **File Sharing** - Upload images and files (PDF, text, JSON, CSV) - auto-deletes after 30 minutes for privacy
  - **Free Storage**: Only files under 500KB are allowed, stored directly in Firestore (no Firebase Storage needed!)
  - Files are converted to Base64 and stored for free
- 🎨 **Modern UI** - Built with Next.js 15, Tailwind CSS, and Shadcn/ui
- 🔥 **Firebase Backend** - Powered by Firestore for real-time updates and Firebase Storage for files

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

**File Storage Options:**

**Option A: Free Base64 Storage (Recommended)**
- ✅ No additional setup required!
- ✅ **Only files under 500KB are allowed** - stored directly in Firestore
- ✅ Completely free (uses existing Firestore quota)
- ✅ Works out of the box

**Note:** The app currently only supports files under 500KB using free Base64 storage. Firebase Storage integration for larger files is available in the code but requires additional setup.

#### Configuring CORS for Firebase Storage (Only if using Storage option)

**Note:** If you only use Base64 storage (files ≤500KB), you can skip this step entirely!

To enable Firebase Storage uploads for larger files:

**Option 1: Using gsutil (Recommended)**
```bash
# Install Google Cloud SDK if not already installed
# Then run:
gsutil cors set cors.json gs://YOUR_STORAGE_BUCKET_NAME
```

**Option 2: Using Firebase Console**
1. Go to Firebase Console → Storage → Settings
2. Scroll to "CORS configuration"
3. Add the following configuration:
   - Origins: `http://localhost:3000`, `https://*.vercel.app`, `https://*.web.app`
   - Methods: `GET, POST, PUT, DELETE, HEAD`
   - Max Age: `3600`
   - Headers: `Content-Type, Authorization, Content-Length, User-Agent, x-goog-resumable`

Replace `YOUR_STORAGE_BUCKET_NAME` with your actual storage bucket name (found in Firebase Console → Storage → Settings).

### 3. Security

- [ ] All environment variables are set in production
- [ ] Encryption key is strong and randomly generated
- [ ] `.env.local` is in `.gitignore` (should already be)
- [ ] Firestore security rules are properly configured

### 4. Testing

- [ ] Test room creation
- [ ] Test text encryption/decryption
- [ ] Test real-time updates
- [ ] Test file upload (images and documents)
- [ ] Verify file auto-deletion after 30 minutes
- [ ] Verify encryption key error handling

## Development

See `apps/web/README.md` for development setup instructions.

## Deployment

This project is configured for Vercel deployment. The `vercel.json` file contains the build configuration.

For other platforms, ensure:
- Build command: `pnpm run build`
- Output directory: `apps/web/.next`
- Install command: `pnpm install --frozen-lockfile`
