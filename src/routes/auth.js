const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { db, collections } = require('../config/firebase');

const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, deviceInfo } = req.body;
    
    // Check if user exists
    const userSnapshot = await db.collection(collections.USERS)
      .where('email', '==', email)
      .get();
    
    if (!userSnapshot.empty) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user document
    const userRef = db.collection(collections.USERS).doc();
    await userRef.set({
      email,
      password: hashedPassword,
      deviceTokens: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: userRef.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'User registered successfully',
      token,
      userId: userRef.id
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const userSnapshot = await db.collection(collections.USERS)
      .where('email', '==', email)
      .limit(1)
      .get();
    
    if (userSnapshot.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: userDoc.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      userId: userDoc.id
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Device linking (for PQC key exchange)
router.post('/link-device', async (req, res) => {
  try {
    const { userId, deviceInfo, pqcPublicKey } = req.body;
    
    // Verify user exists
    const userDoc = await db.collection(collections.USERS).doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Create device document
    const deviceRef = db.collection(collections.DEVICES).doc();
    await deviceRef.set({
      userId,
      deviceInfo,
      pqcPublicKey,
      fcmToken: null, // Will be updated when device registers for push
      lastSeen: new Date(),
      createdAt: new Date()
    });
    
    // Update user's device tokens
    await db.collection(collections.USERS).doc(userId).update({
      deviceTokens: admin.firestore.FieldValue.arrayUnion(deviceRef.id),
      updatedAt: new Date()
    });
    
    res.json({
      message: 'Device linked successfully',
      deviceId: deviceRef.id
    });
    
  } catch (error) {
    console.error('Device linking error:', error);
    res.status(500).json({ error: 'Device linking failed' });
  }
});

module.exports = router;