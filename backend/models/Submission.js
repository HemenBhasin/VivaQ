const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: mongoose.Schema.Types.Mixed, required: true },
  isCorrect: { type: Boolean, default: false },
  points: { type: Number, default: 0 }
});

const submissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: [answerSchema],
  score: { type: Number, required: true },
  totalPossibleScore: { type: Number, required: true },
  percentage: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  timeTakenSeconds: { type: Number, default: 0 },
  status: { type: String, enum: ['in-progress', 'completed'], default: 'completed' },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: Date.now }
});

// Calculate percentage before saving
submissionSchema.pre('save', function(next) {
  if (this.totalPossibleScore > 0) {
    this.percentage = Math.round((this.score / this.totalPossibleScore) * 100);
  }
  next();
});

module.exports = mongoose.model('Submission', submissionSchema);
