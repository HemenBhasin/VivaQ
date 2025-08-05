# VivaQ - Setup Guide

## Prerequisites
- Node.js (v16 or higher)
- MongoDB Atlas account
- Firebase project
- Resend account (for email service)
- Gemini API key (optional)

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/vivaq.git
cd vivaq
```

### 2. Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Configuration

#### Backend Setup
1. Copy `backend/env.example` to `backend/.env`
2. Fill in your actual credentials:
   - MongoDB connection string
   - Resend API key
   - Firebase Admin SDK credentials
   - JWT secret

#### Frontend Setup
1. Copy `frontend/env.example` to `frontend/.env`
2. Fill in your Firebase configuration
3. Update API URL if needed

### 4. Database Setup
1. Create a MongoDB Atlas cluster
2. Get your connection string
3. Add it to `backend/.env`

### 5. Firebase Setup
1. Create a Firebase project
2. Enable Authentication (Email/Password)
3. Download Firebase Admin SDK JSON
4. Add credentials to `backend/.env`

### 6. Email Service Setup
1. Sign up for Resend (https://resend.com)
2. Get your API key
3. Add it to `backend/.env`

### 7. Run the Application

#### Development Mode
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm run dev
```

#### Production Mode
```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd ../backend
npm start
```

## Security Notes
- Never commit `.env` files
- Keep API keys secure
- Use environment variables for all sensitive data
- Regularly rotate API keys

## Deployment
- Backend can be deployed to Heroku, Railway, or similar
- Frontend can be deployed to Vercel, Netlify, or similar
- Set up environment variables on your hosting platform 