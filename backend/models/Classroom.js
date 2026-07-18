const mongoose = require('mongoose');
const crypto = require('crypto');

const classroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  joinCode: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

// Auto-generate a unique join code before saving
classroomSchema.pre('save', function(next) {
  if (!this.joinCode) {
    this.joinCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Classroom', classroomSchema);
