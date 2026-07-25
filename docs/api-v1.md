# Presence API — v1 Contract

Base URL: `http://localhost:4000/api/v1`

All JSON responses:

```json
{ "success": true, "data": { } }
```

Errors:

```json
{ "success": false, "message": "...", "errors": [] }
```

## Health

`GET /health` (no `/api/v1` prefix)

## Auth

### POST `/auth/login`

```json
{ "email": "admin@presence.local", "password": "Admin123!" }
```

Returns `{ token, user }`.

### GET `/auth/me`

Header: `Authorization: Bearer <token>`

## Devices

### POST `/devices/register`

```json
{
  "deviceId": "TAB001",
  "name": "Lobby Kiosk",
  "branchCode": "HQ01",
  "platform": "ANDROID",
  "model": "Pixel Tablet",
  "osVersion": "14",
  "appVersion": "1.0.0"
}
```

### POST `/devices/:deviceId/heartbeat`

```json
{ "appVersion": "1.0.0" }
```

### GET `/devices` (admin)

## Attendance

### POST `/attendance`

Header: Bearer token

```json
{
  "employeeId": "EMP001",
  "deviceId": "TAB001",
  "attendanceType": "CLOCK_IN",
  "timestamp": "2026-07-25T07:15:12.000Z",
  "faceScore": 99.5,
  "branch": "HQ01",
  "clientEventId": "optional-uuid-for-dedupe"
}
```

### GET `/attendance`

Query: `employeeId`, `deviceId`, `type`, `limit`

## Employees / Face sync

### GET `/employees/sync`

Query: `since` (ISO date), `branchCode`

Returns users (with optional embeddings), departments, branches.

### GET `/employees`

Query: `q`, `limit`
