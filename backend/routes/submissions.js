const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const admin = require('../firebaseAdmin');

// Middleware to verify Firebase ID token and admin role
async function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // For demo, assume user with email 'hemenbhasin@gmail.com' is admin
    if (decodedToken.email !== 'hemenbhasin@gmail.com') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Middleware to verify Firebase ID token for students
async function verifyStudent(req, res, next) {
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

// GET /submissions - Fetches all student results for admins
router.get('/submissions', verifyAdmin, async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate('userId', 'email')
      .populate('quizId', 'topic')
      .sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

// GET /submissions/quiz/:quizId - Fetches submissions for a specific quiz
router.get('/submissions/quiz/:quizId', verifyAdmin, async (req, res) => {
  try {
    const { quizId } = req.params;
    const submissions = await Submission.find({ quizId })
      .populate('userId', 'email')
      .populate('quizId', 'topic')
      .sort({ submittedAt: -1 });
    
    // Calculate quiz statistics
    const totalSubmissions = submissions.length;
    const averageScore = totalSubmissions > 0 
      ? submissions.reduce((sum, sub) => sum + sub.percentage, 0) / totalSubmissions 
      : 0;
    const highestScore = totalSubmissions > 0 
      ? Math.max(...submissions.map(sub => sub.percentage))
      : 0;
    const lowestScore = totalSubmissions > 0 
      ? Math.min(...submissions.map(sub => sub.percentage))
      : 0;

    res.json({ 
      submissions, 
      statistics: {
        totalSubmissions,
        averageScore: Math.round(averageScore),
        highestScore: Math.round(highestScore),
        lowestScore: Math.round(lowestScore)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

// GET /submissions/student/:studentId - Fetches submissions for a specific student
router.get('/submissions/student/:studentId', verifyAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;
    const submissions = await Submission.find({ userId: studentId })
      .populate('userId', 'email')
      .populate('quizId', 'topic')
      .sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching student submissions', error: error.message });
  }
});

// GET /student/submissions - Fetches current student's submissions
router.get('/student/submissions', verifyStudent, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await User.findOne({ firebaseUID: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const submissions = await Submission.find({ userId: user._id })
      .populate('quizId', 'topic')
      .sort({ submittedAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

// GET /submission/:submissionId - Get detailed submission with answers
router.get('/submission/:submissionId', verifyAdmin, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId)
      .populate('userId', 'email')
      .populate('quizId', 'topic questions');
    
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submission', error: error.message });
  }
});

module.exports = router;
