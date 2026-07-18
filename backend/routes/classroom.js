const express = require('express');
const router = express.Router();
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const admin = require('../firebaseAdmin');

// Middleware to verify Firebase ID token and admin role
async function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (decodedToken.email !== 'hemenbhasin@gmail.com') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Middleware to verify any authenticated user
async function verifyUser(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Helper to get or create a User document from firebase uid
async function getOrCreateUser(firebaseUser, role = 'student') {
  let user = await User.findOne({ firebaseUID: firebaseUser.uid });
  if (!user) {
    user = new User({
      firebaseUID: firebaseUser.uid,
      email: firebaseUser.email,
      role
    });
    await user.save();
  }
  return user;
}

// POST /api/classrooms - Admin creates a classroom
router.post('/', verifyAdmin, express.json(), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Classroom name is required' });

    const admin_user = await getOrCreateUser(req.user, 'admin');

    const classroom = new Classroom({
      name,
      description: description || '',
      adminId: admin_user._id
    });
    await classroom.save();

    res.status(201).json({ message: 'Classroom created successfully', classroom });
  } catch (error) {
    console.error('Error creating classroom:', error);
    res.status(500).json({ message: 'Error creating classroom', error: error.message });
  }
});

// GET /api/classrooms/admin - Admin gets their classrooms
router.get('/admin', verifyAdmin, async (req, res) => {
  try {
    const admin_user = await getOrCreateUser(req.user, 'admin');

    const classrooms = await Classroom.find({ adminId: admin_user._id })
      .populate('students', 'email')
      .sort({ createdAt: -1 });

    res.json({ classrooms });
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    res.status(500).json({ message: 'Error fetching classrooms', error: error.message });
  }
});

// GET /api/classrooms/student - Student gets classrooms they joined
router.get('/student', verifyUser, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.user, 'student');

    const classrooms = await Classroom.find({ students: user._id })
      .populate('adminId', 'email')
      .sort({ createdAt: -1 });

    res.json({ classrooms });
  } catch (error) {
    console.error('Error fetching student classrooms:', error);
    res.status(500).json({ message: 'Error fetching classrooms', error: error.message });
  }
});

// POST /api/classrooms/join - Student joins a classroom with a code
router.post('/join', verifyUser, express.json(), async (req, res) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode) return res.status(400).json({ message: 'Join code is required' });

    const user = await getOrCreateUser(req.user, 'student');

    const classroom = await Classroom.findOne({ joinCode: joinCode.toUpperCase().trim() });
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found. Please check the code.' });
    }

    // Check if already a member
    if (classroom.students.includes(user._id)) {
      return res.status(400).json({ message: 'You are already a member of this classroom.' });
    }

    classroom.students.push(user._id);
    await classroom.save();

    res.json({ message: `Successfully joined "${classroom.name}"!`, classroom });
  } catch (error) {
    console.error('Error joining classroom:', error);
    res.status(500).json({ message: 'Error joining classroom', error: error.message });
  }
});

// DELETE /api/classrooms/:id - Admin deletes a classroom
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const admin_user = await getOrCreateUser(req.user, 'admin');
    const classroom = await Classroom.findOne({ _id: req.params.id, adminId: admin_user._id });
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }
    await classroom.deleteOne();
    res.json({ message: 'Classroom deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting classroom', error: error.message });
  }
});

module.exports = router;
