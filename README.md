# VivaQ - AI-Powered Quiz Platform

VivaQ is a comprehensive quiz platform with Gemini AI integration for real-time quiz generation. The platform supports both admin and student workflows with advanced features like time limits, analytics, and detailed scoring.

## Features Implemented

### Admin Features
- **Quiz Generation**: Create quizzes manually or using Gemini AI integration
- **Time Limits**: Set time limits for quiz attempts (1-180 minutes)
- **Availability Settings**: Configure quiz availability start and end times
- **Analytics Dashboard**: View student submissions, scores, and detailed analytics
- **Student Answer Review**: View detailed student answers and correct responses
- **Quiz Statistics**: Track average scores, highest/lowest scores, and submission counts

### Student Features
- **Quiz Taking Interface**: Interactive quiz interface with progress tracking
- **Timer Display**: Real-time countdown timer for time-limited quizzes
- **Score Viewing**: View completed quiz scores and performance metrics
- **Quiz History**: Access to all completed quizzes with detailed results
- **Responsive Design**: Mobile-friendly interface for quiz taking

### Technical Features
- **Firebase Authentication**: Secure user authentication and role-based access
- **MongoDB Database**: Scalable data storage for quizzes and submissions
- **Real-time Updates**: Live timer and progress tracking
- **API Security**: Token-based authentication for all API endpoints
- **Error Handling**: Comprehensive error handling and user feedback

## Project Structure

```
VivaQ/
├── backend/
│   ├── models/
│   │   ├── Quiz.js          # Quiz data model
│   │   ├── Submission.js    # Submission data model
│   │   └── User.js          # User data model
│   ├── routes/
│   │   ├── quiz.js          # Quiz-related API endpoints
│   │   └── submissions.js   # Submission-related API endpoints
│   ├── server.js            # Express server setup
│   ├── firebaseAdmin.js     # Firebase admin configuration
│   └── package.json         # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminDashboard.jsx    # Admin dashboard with navigation
│   │   │   ├── AdminAnalytics.jsx    # Analytics and submission viewing
│   │   │   ├── QuizGenerator.jsx     # AI-powered quiz generation
│   │   │   ├── QuizTaker.jsx         # Student quiz taking interface
│   │   │   ├── StudentDashboard.jsx  # Student dashboard with scores
│   │   │   ├── Login.jsx             # Authentication component
│   │   │   └── ProtectedRoute.jsx    # Route protection component
│   │   ├── App.jsx                   # Main application component
│   │   └── main.jsx                  # Application entry point
│   ├── firebaseConfig.js    # Firebase configuration
│   └── package.json         # Frontend dependencies
└── README.md               # This file
```

## API Endpoints

### Quiz Management
- `POST /api/generate-quiz` - Generate quiz using Gemini AI
- `POST /api/save-quiz` - Save and assign quiz to students
- `GET /api/quizzes` - Get available quizzes for students
- `GET /api/quiz/:id` - Get specific quiz for taking
- `POST /api/submit-quiz` - Submit quiz answers and calculate score
- `GET /api/admin/quizzes` - Get all quizzes for admin

### Submissions & Analytics
- `GET /api/submissions` - Get all submissions (admin)
- `GET /api/submissions/quiz/:quizId` - Get submissions for specific quiz
- `GET /api/submissions/student/:studentId` - Get submissions for specific student
- `GET /api/student/submissions` - Get current student's submissions
- `GET /api/submission/:submissionId` - Get detailed submission with answers

## Database Models

### Quiz Model
```javascript
{
  topic: String,
  description: String,
  questionType: String,
  questions: [QuestionSchema],
  createdBy: ObjectId,
  availabilityStart: Date,
  availabilityEnd: Date,
  timeLimitMinutes: Number,
  assignedTo: [ObjectId],
  status: String,
  totalPoints: Number
}
```

### Submission Model
```javascript
{
  userId: ObjectId,
  quizId: ObjectId,
  answers: [AnswerSchema],
  score: Number,
  totalPossibleScore: Number,
  percentage: Number,
  timeTakenSeconds: Number,
  status: String,
  startedAt: Date,
  submittedAt: Date
}
```

## Setup Instructions

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   MONGODB_URI=your_mongodb_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   PORT=5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Firebase configuration:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage Guide

### For Admins
1. **Generate Quiz**: Use the quiz generator to create quizzes with AI assistance
2. **Set Time Limits**: Configure time limits and availability windows
3. **View Analytics**: Access the analytics dashboard to view student performance
4. **Review Submissions**: Click on individual submissions to view detailed answers

### For Students
1. **View Available Quizzes**: See all assigned quizzes on the dashboard
2. **Take Quiz**: Click "Start Quiz" to begin a quiz attempt
3. **Monitor Time**: Watch the countdown timer during time-limited quizzes
4. **View Scores**: Access completed quiz scores and performance metrics

## Key Features

### Time Management
- Configurable time limits (1-180 minutes)
- Real-time countdown timer
- Automatic submission when time expires
- Time tracking for analytics

### Scoring System
- Automatic scoring based on question type
- Percentage calculation
- Points tracking (10 points per question)
- Performance analytics

### Security Features
- Firebase authentication
- Role-based access control
- Token-based API security
- Input validation and sanitization

### User Experience
- Responsive design for mobile devices
- Progress tracking during quiz taking
- Real-time feedback and error handling
- Intuitive navigation and UI

## Technology Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Authentication**: Firebase Authentication
- **AI Integration**: Google Gemini API
- **Database**: MongoDB Atlas

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. 