# Firebase Configuration Instructions

## 1. Service Account Setup
1. Download your service account key from Firebase Console
2. Save it as `service-account-key.json` in the backend root directory
3. Update the path in `src/config/firebase.js`

## 2. Environment Variables
Create a `.env` file in your backend directory:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
JWT_SECRET=your-jwt-secret-key
```

## 3. Firebase Services Configuration

### Firestore Security Rules
Go to Firebase Console > Firestore > Rules and set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Devices can only be accessed by their owners
    match /devices/{deviceId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Auth challenges have specific security requirements
    match /authChallenges/{challengeId} {
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == resource.data.deviceId);
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.deviceId;
    }
  }
}
```

### FCM Configuration
For push notifications, you'll need to:
1. Add your mobile app package name to Firebase Console
2. Download `google-services.json` (Android) and/or `GoogleService-Info.plist` (iOS)
3. Place them in your mobile app directory

## 4. Mobile App Firebase Setup

Install Firebase dependencies in your mobile app:
```bash
cd quantum-auth-mobile
expo install firebase
expo install expo-notifications
```

Create `firebaseConfig.js` in mobile app:
```javascript
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

export default firebaseConfig;
```