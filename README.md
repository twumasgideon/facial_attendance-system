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
