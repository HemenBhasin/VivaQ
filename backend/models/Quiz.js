const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be string, array, boolean, or number
  questionType: { type: String, enum: ['MCQ', 'Text', 'TrueFalse', 'Numeric', 'Checkbox'], required: true }
});

const quizSchema = new mongoose.Schema({
  topic: { type: String, required: true },
  questionType: { type: String, enum: ['MCQ', 'Text', 'TrueFalse', 'Numeric', 'Checkbox'], required: true },
  questions: [questionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  availabilityStart: { type: Date, default: null },
  availabilityEnd: { type: Date, default: null },
  timeLimitMinutes: { type: Number, default: null },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' },
  totalPoints: { type: Number, default: 0 },
  description: { type: String, default: '' }
});

// Calculate total points when quiz is saved
quizSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.questions.length * 10; // 10 points per question
  }
  next();
});

module.exports = mongoose.model('Quiz', quizSchema);
