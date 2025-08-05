const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const quizRoutes = require('./routes/quiz');
const submissionRoutes = require('./routes/submissions');
const contactRoutes = require('./routes/contact');

app.use('/api', quizRoutes);
app.use('/api', submissionRoutes);
app.use('/api', contactRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Quiz Platform API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hemenbhasin:KkNuaZUs7ssmdQ5D@vivaq.xsfnzrq.mongodb.net/vivaq?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
})
.then(() => console.log('MongoDB connected successfully'))
.catch((err) => {
  console.error('MongoDB connection error:', err);
  console.log('\nTo fix this issue:');
  console.log('1. Go to MongoDB Atlas dashboard');
  console.log('2. Navigate to Network Access');
  console.log('3. Click "Add IP Address"');
  console.log('4. Add your current IP or use "0.0.0.0/0" for all IPs (development only)');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
