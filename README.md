# Presence — Android Facial Recognition Attendance

Smart attendance for Android tablets/kiosks: face recognition clock-in/out, offline queue, and cloud sync.

## Repo layout

```
backend/     Node.js Express API + MongoDB
android/     Kotlin Jetpack Compose tablet/kiosk app
docs/        API contract
```

## Prerequisites

- Node.js 20+
- MongoDB 7+ **or** leave `USE_MEMORY_DB=true` for local demo (no Mongo install)
- Android Studio Ladybug+ / JDK 17 (for the Android app)

## Backend (quick start)

MongoDB is already installed on this machine at `C:\Program Files\MongoDB\Server\8.3\`. Start it once:

```bash
# from repo root (Git Bash)
mkdir -p .data/mongo
"/c/Program Files/MongoDB/Server/8.3/bin/mongod.exe" --dbpath "$(pwd)/.data/mongo" --port 27017 --bind_ip 127.0.0.1
```

Then:

```bash
cd backend
cp .env.example .env   # set USE_MEMORY_DB=false
npm install
npm run dev
```

API: [http://localhost:4000](http://localhost:4000)

Demo admin (auto-seeded on first boot):

- Email: `admin@presence.local`
- Password: `Admin123!`
- Branch code: `HQ01`

Health check:

```bash
curl http://localhost:4000/health
```

Login:

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@presence.local\",\"password\":\"Admin123!\"}"
```

`USE_MEMORY_DB=true` is optional and often fails on Windows; prefer the local `mongod` path above.

## Android app

1. Open `android/` in Android Studio.
2. Let Gradle sync (wrapper will be generated / downloaded).
3. Run on an Android 11+ tablet/emulator (API 30+).
4. Emulator → host API uses default `http://10.0.2.2:4000/api/v1`.
5. In **Settings**: Login → Register this device.

Home shell includes Clock In/Out, People, Sync, Settings, Status, Power. Camera preview is live (P0 stub); face matching is Phase 1.

## Standalone phone app (no Expo Go)

Install **Presence** as a normal app icon on Android / iPhone using EAS Build (cloud). Your PC does not need Android Studio or a Mac for Android APK builds.

### 1. One-time setup (on your PC)

```bash
cd /d/facial_attendance-system/mobile
npm install -g eas-cli
eas login
eas init
```

Use a free Expo account (any email). `eas init` links this project and writes a `projectId` into `app.json`.

### 2. Build Android APK (installable file)

```bash
cd /d/facial_attendance-system/mobile
npm run build:android
```

When the build finishes, open the link EAS prints, download the **.apk**, copy it to the phone, and install it.  
You will see a **Presence** icon — tap it to open the app (no Expo Go).

### 3. iPhone

```bash
npm run build:ios
```

iOS needs an **Apple Developer** account to install on a real iPhone (TestFlight or direct device). Without that, use Android APK or the web/Expo Go path for testing.

### App identity

| Field | Value |
|-------|--------|
| App name | Presence |
| Android package | `com.presence.attendance` |
| iOS bundle ID | `com.presence.attendance` |

After install: **Settings → Login → Register device**, then use Clock In / Register Member as usual.

## Mobile app (Android + iOS) — Expo Go (dev only)

Cross-platform Expo app in `mobile/` — one codebase for phones and tablets.

```bash
cd mobile
npm install
npx expo start
```

Then:
- Scan the QR code with **Expo Go** on Android or iOS, or
- Press `a` for Android emulator / `i` for iOS simulator (Mac)

**First-run setup in the app**
1. Open **Settings**
2. API URL is prefilled to Vercel (`…/api/v1`) — or use Render
3. **Login** with `admin@presence.local` / `Admin123!`
4. **Register this device** (branch `HQ01`)
5. Use **Clock In / Out**, **People**, **Face Sync**

Native Kotlin tablet shell remains under `android/` for the dedicated kiosk track.

## Deploy on Render

Do **not** choose Rust. This service must be **Node**.

### Fix an existing failed service
1. Render → your service → **Settings**
2. **Runtime** → **Node**
3. **Root Directory** → `backend`
4. **Build Command** → `npm install`
5. **Start Command** → `npm start`
6. **Environment** → add:

| Key | Value |
|-----|--------|
| `MONGODB_URI` | MongoDB Atlas URI |
| `JWT_SECRET` | long random secret |
| `USE_MEMORY_DB` | `false` |
| `NODE_ENV` | `production` |
| `ADMIN_EMAIL` | `admin@presence.local` |
| `ADMIN_PASSWORD` | your password |

7. **Manual Deploy** → clear build cache & deploy

Or delete the Rust service and create a new **Web Service** with runtime **Node**, root `backend`.

A `render.yaml` is included at the repo root for Blueprint deploys.

## Deploy on Vercel

This API is wired for Vercel serverless (`vercel.json` + `backend/api/index.js`).

1. Push this repo to GitHub (Vercel reads from git).
2. In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Value |
|------|--------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | long random secret |
| `USE_MEMORY_DB` | `false` |
| `ADMIN_EMAIL` | `admin@presence.local` |
| `ADMIN_PASSWORD` | strong password |
| `NODE_ENV` | `production` |

3. Redeploy.
4. Open `https://your-app.vercel.app/health` — should return `"status":"ok"`.
5. In the Android app Settings, set API URL to `https://your-app.vercel.app/api/v1`.

You need a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster; local MongoDB will not work on Vercel.

## Phase status

| Phase | Status |
|-------|--------|
| P0 Foundation | Started — API running + Android shell scaffolded |
| P1 MVP Recognition | Next |
| P2 Sync & Offline | Planned |
| P3 Rules & Admin | Planned |
| P4 Hardening | Planned |
| P5 iOS & Scale | Planned |

See the interactive roadmap canvas in Cursor and `docs/api-v1.md`.
