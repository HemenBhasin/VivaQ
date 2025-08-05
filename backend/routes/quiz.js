const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const Submission = require('../models/Submission');
const User = require('../models/User');
const admin = require('../firebaseAdmin');
const { GoogleGenAI } = require('@google/genai');
const mongoose = require('mongoose');

// Initialize Gemini API client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

// POST /generate-quiz - Calls Gemini API to generate quiz questions
router.post('/generate-quiz', verifyAdmin, express.json(), async (req, res) => {
  const { topic, questionType, numberOfQuestions } = req.body;
  try {
    // Construct prompt for Gemini API
    const prompt = `Generate ${numberOfQuestions} quiz questions on the topic "${topic}" with question type "${questionType}". Provide questions and answers in JSON format with fields: questionText, options (if MCQ), and correctAnswer.`;

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    // Parse response text as JSON
    let questions = [];
    try {
      questions = JSON.parse(response.text);
    } catch (parseError) {
      // If parsing fails, return error
      return res.status(500).json({ message: 'Failed to parse Gemini API response', error: parseError.message });
    }

    res.json({ questions });
  } catch (error) {
    res.status(500).json({ message: 'Error generating quiz', error: error.message });
  }
});

// POST /save-quiz - Saves finalized quiz to MongoDB and assigns to students
router.post('/save-quiz', verifyAdmin, express.json(), async (req, res) => {
  const quizData = req.body;
  console.log('Received quiz data:', JSON.stringify(quizData, null, 2));
  
  try {
    // Find or create user document
    let user = await User.findOne({ firebaseUID: req.user.uid });
    console.log('Found user:', user ? user._id : 'Not found');
    
    if (!user) {
      // Create user document if it doesn't exist
      user = new User({
        firebaseUID: req.user.uid,
        email: req.user.email,
        role: 'admin'
      });
      await user.save();
      console.log('Created new user:', user._id);
    }

    // Update quiz data with proper user reference
    const quizToSave = {
      ...quizData,
      createdBy: user._id, // Use MongoDB ObjectId instead of Firebase UID
      status: quizData.status || 'active'
    };
    
    console.log('Quiz to save:', JSON.stringify(quizToSave, null, 2));

    // Save quiz with assignedTo field
    const quiz = new Quiz(quizToSave);
    await quiz.save();
    console.log('Quiz saved successfully:', quiz._id);
    res.status(201).json({ message: 'Quiz saved and assigned successfully', quiz });
  } catch (error) {
    console.error('Error saving quiz:', error);
    res.status(500).json({ message: 'Error saving quiz', error: error.message });
  }
});

// GET /quizzes - Fetches quizzes for students
router.get('/quizzes', verifyStudent, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('Student requesting quizzes, Firebase UID:', userId);
    
    // Find user in database
    let user = await User.findOne({ firebaseUID: userId });
    if (!user) {
      console.log('User not found, creating student user');
      // Create student user if it doesn't exist
      user = new User({
        firebaseUID: userId,
        email: req.user.email,
        role: 'student'
      });
      await user.save();
      console.log('Created new student user:', user._id);
    } else {
      console.log('Found existing user:', user._id, 'Role:', user.role);
    }

    // Find quizzes assigned to this user or assigned to all (empty assignedTo means assigned to all)
    const quizzes = await Quiz.find({
      $or: [
        { assignedTo: { $exists: false } },
        { assignedTo: { $size: 0 } },
        { assignedTo: user._id }
      ],
      status: 'active'
    }).populate('createdBy', 'email');

    console.log('Found quizzes:', quizzes.length);

    // Check availability and time limits
    const now = new Date();
    const availableQuizzes = quizzes.filter(quiz => {
      const isAvailable = (!quiz.availabilityStart || now >= quiz.availabilityStart) &&
                         (!quiz.availabilityEnd || now <= quiz.availabilityEnd);
      console.log(`Quiz ${quiz._id}: available=${isAvailable}, start=${quiz.availabilityStart}, end=${quiz.availabilityEnd}`);
      return isAvailable;
    });

    console.log('Available quizzes:', availableQuizzes.length);
    res.json({ quizzes: availableQuizzes });
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
  }
});

// GET /quiz/:id - Get specific quiz for taking
router.get('/quiz/:id', verifyStudent, async (req, res) => {
  try {
    const quizId = req.params.id;
    const userId = req.user.uid;
    
    const user = await User.findOne({ firebaseUID: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const quiz = await Quiz.findById(quizId).populate('createdBy', 'email');
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check if user is assigned to this quiz
    const isAssigned = !quiz.assignedTo.length || quiz.assignedTo.includes(user._id);
    if (!isAssigned) {
      return res.status(403).json({ message: 'You are not assigned to this quiz' });
    }

    // Check availability
    const now = new Date();
    if (quiz.availabilityStart && now < quiz.availabilityStart) {
      return res.status(403).json({ message: 'Quiz is not available yet' });
    }
    if (quiz.availabilityEnd && now > quiz.availabilityEnd) {
      return res.status(403).json({ message: 'Quiz is no longer available' });
    }

    // Check if user has already submitted
    const existingSubmission = await Submission.findOne({ userId: user._id, quizId: quiz._id });
    if (existingSubmission && existingSubmission.status === 'completed') {
      return res.status(400).json({ message: 'You have already completed this quiz' });
    }

    // Remove correct answers for security
    const quizForStudent = {
      _id: quiz._id,
      topic: quiz.topic,
      description: quiz.description,
      timeLimitMinutes: quiz.timeLimitMinutes,
      totalPoints: quiz.totalPoints,
      questions: quiz.questions.map(q => ({
        _id: q._id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options
      }))
    };

    res.json({ quiz: quizForStudent });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quiz', error: error.message });
  }
});

// POST /submit-quiz - Submit quiz answers
router.post('/submit-quiz', verifyStudent, express.json(), async (req, res) => {
  try {
    const { quizId, answers, timeTakenSeconds } = req.body;
    const userId = req.user.uid;
    
    console.log('Quiz submission request:', {
      quizId,
      userId,
      answersCount: answers?.length,
      timeTakenSeconds
    });
    
    // Validate input
    if (!quizId) {
      return res.status(400).json({ message: 'Quiz ID is required' });
    }
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array is required' });
    }
    if (!timeTakenSeconds) {
      return res.status(400).json({ message: 'Time taken is required' });
    }
    
    const user = await User.findOne({ firebaseUID: userId });
    if (!user) {
      console.log('User not found for quiz submission');
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('Found user for submission:', user._id);

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      console.log('Quiz not found for submission:', quizId);
      return res.status(404).json({ message: 'Quiz not found' });
    }
    console.log('Found quiz for submission:', quiz._id);

    // Check if already submitted
    const existingSubmission = await Submission.findOne({ userId: user._id, quizId: quiz._id });
    if (existingSubmission && existingSubmission.status === 'completed') {
      console.log('Quiz already submitted by user');
      return res.status(400).json({ message: 'Quiz already submitted' });
    }

    // Calculate score
    let score = 0;
    const processedAnswers = [];

    console.log('Processing answers:', answers.length);
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      const question = quiz.questions[i];
      
      if (!question) {
        console.error(`Question ${i} not found in quiz`);
        continue;
      }
      
      let isCorrect = false;
      let points = 0;

      console.log(`Question ${i + 1}:`, {
        questionType: question.questionType,
        studentAnswer: answer.answer,
        correctAnswer: question.correctAnswer
      });

      // Check if answer is correct based on question type
      if (question.questionType === 'MCQ') {
        isCorrect = answer.answer === question.correctAnswer;
      } else if (question.questionType === 'TrueFalse') {
        isCorrect = answer.answer === question.correctAnswer;
      } else if (question.questionType === 'Text') {
        // For text answers, do case-insensitive comparison
        isCorrect = answer.answer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
      } else if (question.questionType === 'Checkbox') {
        // For checkbox questions, check if all correct answers are selected
        const studentAnswers = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
        const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
        
        // Check if all correct answers are selected and no incorrect answers are selected
        const allCorrectSelected = correctAnswers.every(correct => studentAnswers.includes(correct));
        const noIncorrectSelected = studentAnswers.every(selected => correctAnswers.includes(selected));
        isCorrect = allCorrectSelected && noIncorrectSelected;
      }

      if (isCorrect) {
        points = 10; // 10 points per correct answer
        score += points;
      }

      try {
        processedAnswers.push({
          questionId: new mongoose.Types.ObjectId(question._id),
          answer: answer.answer,
          isCorrect,
          points
        });
      } catch (error) {
        console.error('Error processing answer:', error);
        throw new Error(`Error processing answer for question ${i + 1}: ${error.message}`);
      }
    }

    console.log('Score calculation:', { score, totalPossibleScore: quiz.totalPoints });

    // Create or update submission
    const submissionData = {
      userId: user._id,
      quizId: quiz._id,
      answers: processedAnswers,
      score,
      totalPossibleScore: quiz.totalPoints,
      percentage: Math.round((score / quiz.totalPoints) * 100), // Calculate percentage manually
      timeTakenSeconds,
      status: 'completed',
      submittedAt: new Date()
    };

    console.log('Submission data:', submissionData);

    let submission;
    try {
      if (existingSubmission) {
        submission = await Submission.findByIdAndUpdate(existingSubmission._id, submissionData, { new: true });
        console.log('Updated existing submission:', submission._id);
      } else {
        submission = new Submission(submissionData);
        await submission.save();
        console.log('Created new submission:', submission._id);
      }
    } catch (error) {
      console.error('Error saving submission:', error);
      throw new Error(`Error saving submission: ${error.message}`);
    }

    res.json({ 
      message: 'Quiz submitted successfully',
      submission: {
        score: submission.score,
        totalPossibleScore: submission.totalPossibleScore,
        percentage: submission.percentage,
        timeTakenSeconds: submission.timeTakenSeconds
      }
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Error submitting quiz', error: error.message });
  }
});

// GET /admin/quizzes - Get all quizzes for admin dashboard
router.get('/admin/quizzes', verifyAdmin, async (req, res) => {
  try {
    const quizzes = await Quiz.find().populate('createdBy', 'email').sort({ createdAt: -1 });
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
  }
});

// GET /admin/quiz/:id/submissions - Get submissions for a specific quiz
router.get('/admin/quiz/:id/submissions', verifyAdmin, async (req, res) => {
  try {
    const quizId = req.params.id;
    const submissions = await Submission.find({ quizId })
      .populate('userId', 'email')
      .populate('quizId', 'topic')
      .sort({ submittedAt: -1 });
    
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

// GET /student/submissions - Get student's own submissions
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
    
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

module.exports = router;
