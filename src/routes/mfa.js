const express = require('express');
const jwt = require('jsonwebtoken');
const { db, messaging, collections } = require('../config/firebase');

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Create authentication challenge
router.post('/create-challenge', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { deviceId, action } = req.body;
    
    // Generate random challenge
    const challenge = require('crypto').randomBytes(32).toString('hex');
    
    // Create challenge document
    const challengeRef = db.collection(collections.AUTH_CHALLENGES).doc();
    await challengeRef.set({
      userId,
      deviceId,
      challenge,
      action: action || 'login',
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });
    
    // Get device FCM token
    const deviceDoc = await db.collection(collections.DEVICES).doc(deviceId).get();
    if (!deviceDoc.exists) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const deviceData = deviceDoc.data();
    if (!deviceData.fcmToken) {
      return res.status(400).json({ error: 'Device not registered for push notifications' });
    }
    
    // Send push notification
    const message = {
      notification: {
        title: 'Authentication Request',
        body: `Approve login attempt for ${action || 'your account'}`
      },
      data: {
        challengeId: challengeRef.id,
        challenge: challenge,
        action: action || 'login',
        timestamp: Date.now().toString()
      },
      token: deviceData.fcmToken
    };
    
    await messaging.send(message);
    
    res.json({
      message: 'Challenge created and push notification sent',
      challengeId: challengeRef.id,
      challenge
    });
    
  } catch (error) {
    console.error('Challenge creation error:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// Verify challenge response (with PQC signature)
router.post('/verify-challenge', async (req, res) => {
  try {
    const { challengeId, signature, pqcPublicKey } = req.body;
    
    // Get challenge document
    const challengeDoc = await db.collection(collections.AUTH_CHALLENGES).doc(challengeId).get();
    if (!challengeDoc.exists) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    
    const challengeData = challengeDoc.data();
    
    // Check if challenge is expired
    if (new Date() > challengeData.expiresAt.toDate()) {
      await challengeDoc.ref.update({ status: 'expired' });
      return res.status(400).json({ error: 'Challenge expired' });
    }
    
    // Verify PQC signature (you'll implement this with your PQC library)
    // This is where you'll use Dilithium to verify the signature
    const isValidSignature = await verifyPQCSignature(
      challengeData.challenge,
      signature,
      pqcPublicKey
    );
    
    if (!isValidSignature) {
      await challengeDoc.ref.update({ status: 'denied' });
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Update challenge status
    await challengeDoc.ref.update({
      status: 'approved',
      verifiedAt: new Date()
    });
    
    // Generate session token
    const sessionToken = jwt.sign(
      { 
        userId: challengeData.userId,
        deviceId: challengeData.deviceId,
        challengeId 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Challenge verified successfully',
      sessionToken,
      status: 'approved'
    });
    
  } catch (error) {
    console.error('Challenge verification error:', error);
    res.status(500).json({ error: 'Failed to verify challenge' });
  }
});

// Mock PQC signature verification (replace with real Dilithium verification)
async function verifyPQCSignature(challenge, signature, publicKey) {
  // TODO: Implement real Dilithium signature verification
  // For now, return true for testing
  return true;
}

module.exports = router;