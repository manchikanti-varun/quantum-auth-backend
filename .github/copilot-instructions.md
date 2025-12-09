# Copilot Instructions — QSafe Backend

## Project Overview
**QSafe** is a quantum-safe mobile authenticator providing push-based MFA with Post-Quantum Cryptography (PQC) and offline TOTP fallback. The backend (Node.js + Express + Firebase) handles:
- JWT-based user auth & device registration
- Push challenge creation + PQC (Dilithium) signature verification
- TOTP validation (RFC 6238)
- Real-time device linking via public key enrollment
- Zero-trust policy enforcement with device-bound operations

## Architecture

### Core Components
- **Express Server** (`src/index.js`): RESTful API routes for auth, device linking, MFA challenges
- **Firebase Integration**: Firestore (user/device/challenge data) + FCM (push notifications)
- **PQC Libraries**: 
  - `@openpgp/crystals-kyber-js` — Key encapsulation (future use)
  - `dilithium-crystals-js` — Digital signatures for challenge approval
- **Security**: JWT (access/refresh tokens), bcrypt (password hashing), rate limiting (express-rate-limit)

### Data Flow (Push MFA)
```
1. User login request → Backend verifies JWT
2. Backend generates challenge (challenge_id, nonce, timestamp)
3. Firebase FCM sends challenge to mobile device
4. Mobile: User approves → signs challenge with Dilithium private key
5. Backend: Receives signature → verifies with stored Dilithium public key
6. Success → issue session token; Failure → deny access
```

## Key Conventions & Patterns

### Environment Setup
- **Local dev**: `npm run dev` (nodemon watches `src/index.js`)
- **Production**: `npm start`
- **Config**: Load from `.env` (PORT, Firebase credentials, JWT secret, PQC keys)

### API Design
- All endpoints return JSON: `{ success: boolean, data?: object, error?: string }`
- Error responses include HTTP status + descriptive error message
- Payload validation on all POST/PUT routes
- Rate limiting applied to sensitive endpoints (auth, device linking)

### JWT Token Structure
- **Access Token**: Short-lived (15 min), includes `userId`, `deviceId`, `scope`
- **Refresh Token**: Long-lived (7 days), stored in HttpOnly cookie or secure storage
- Decode via `jsonwebtoken.verify()`, validate expiry + signature

### PQC Signature Verification
- Dilithium public keys stored in Firestore under `users/{userId}/devices/{deviceId}`
- On challenge approval: `dilithium.verify(signature, challenge_bytes, public_key)`
- Failures logged + invalid signatures trigger rate limit increment

### Database Schema (Firestore)
```
users/{userId}
  - email: string
  - passwordHash: string (bcrypt)
  - createdAt: timestamp
  
users/{userId}/devices/{deviceId}
  - dilithium_public_key: string (base64)
  - kyber_public_key: string (base64, future)
  - linkedAt: timestamp
  - lastSeen: timestamp
  
mfa_challenges/{challengeId}
  - userId: string
  - deviceId: string
  - challenge_nonce: string
  - createdAt: timestamp
  - expiresAt: timestamp (5 min)
  - approved: boolean
  - signature: string (from mobile)
```

## Development Workflow

### Adding a New Auth Route
1. Create handler in `src/routes/` (e.g., `src/routes/auth.js`)
2. Import + register in `src/index.js` with `app.post('/api/auth/route', handler)`
3. Validate input → Execute business logic → Return JSON response
4. Example:
   ```javascript
   app.post('/api/auth/link-device', (req, res) => {
     const { userId, dilithium_pk } = req.body;
     // Validate JWT token, verify userId
     // Save public key to Firestore
     // Return { success: true, deviceId }
   });
   ```

### Adding PQC Verification Logic
1. Import `dilithium` from library
2. Retrieve stored public key from Firestore: `users/{userId}/devices/{deviceId}.dilithium_public_key`
3. Verify signature: `dilithium.verify(signature, messageBytes, publicKeyBuffer)`
4. Log verification outcome (success/failure) with sanitized details
5. Update challenge status + issue tokens on success

### Testing PQC Operations
- Mock Dilithium during Phase 1 (workflow validation)
- Replace with real library in Phase 2
- Test: invalid signature rejection, expired challenge rejection, replay attack prevention

## Critical Files & Patterns
- **`src/index.js`**: Server setup, middleware (CORS, helmet, rate limiting), route registration
- **`package.json`**: Real PQC libraries (`dilithium-crystals-js`, `@openpgp/crystals-kyber-js`), Firebase SDK
- **Security Middleware**: Helmet for HTTP headers, rate limiting for brute-force protection
- **Error Handling**: All try-catch blocks should log errors + return generic messages (no internal details)

## Phase 1 Deliverables (Current Focus)
- ✅ User registration + JWT issuance
- ✅ Device linking endpoint (store Dilithium public key)
- ✅ MFA challenge creation (mock signature validation)
- ⚠️ Firebase Firestore integration (data schema + queries)
- ⚠️ Express server scaffold + CORS + rate limiting
- ❌ Real Dilithium library integration (Phase 2)
- ❌ FCM push + TOTP backend validation (Phase 2+)

## Common Tasks
- **Add new route**: Create in `src/routes/`, import + register in `index.js`
- **Update Firestore schema**: Modify collection structure in Firebase console + update code to match
- **Test locally**: `npm run dev` + use Postman/curl to test endpoints
- **Debug JWT issues**: Log token payload via `jwt.decode(token)` + check expiry
- **Add rate limiting**: Wrap route with `rateLimit` middleware (already available via express-rate-limit)
