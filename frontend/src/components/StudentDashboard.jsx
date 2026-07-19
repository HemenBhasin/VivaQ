import { auth } from '../firebaseConfig';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { API_BASE } from '../apiConfig';
import QuizTaker from './QuizTaker';
import JoinClassroom from './JoinClassroom';

function StudentDashboard() {
  const [quizzes, setQuizzes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') ? 'classrooms' : 'quizzes';
  });
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  useEffect(() => {
    fetchQuizzes();
    fetchSubmissions();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      console.log('Fetching quizzes with token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_BASE}/api/quizzes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Quizzes data:', data);
      setQuizzes(data.quizzes || []);
    } catch (err) {
      console.error('Error fetching quizzes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/student/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }
      
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    }
  };

  const handleQuizComplete = (submission) => {
    if (submission && submission.status !== 'in-progress') {
      setQuizCompleted(submission);
    }
    setSelectedQuiz(null);
    fetchSubmissions(); // Refresh submissions
  };

  const startQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setQuizCompleted(null);
  };

  const isQuizCompleted = (quizId) => {
    return submissions.some(sub => sub.quizId._id === quizId && sub.status === 'completed');
  };

  const isQuizInProgress = (quizId) => {
    return submissions.some(sub => sub.quizId._id === quizId && sub.status === 'in-progress');
  };

  const getSubmissionForQuiz = (quizId) => {
    return submissions.find(sub => sub.quizId._id === quizId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full"
        ></motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 max-w-md w-full"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
            <p className="text-purple-200 mb-6">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={fetchQuizzes}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/25"
            >
              Try Again
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (selectedQuiz) {
    return (
      <QuizTaker 
        quizId={selectedQuiz._id} 
        onComplete={handleQuizComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      <div className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex justify-between items-center mb-8 flex-wrap gap-4"
          >
            <div className="flex items-center space-x-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Student Dashboard</h1>
                <p className="text-purple-200">Take quizzes and track your progress</p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              {[
                { key: 'quizzes', label: 'Quizzes', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
                { key: 'classrooms', label: 'Classrooms', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
                { key: 'scores', label: 'My Scores', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
              ].map(tab => (
                <motion.button
                  key={tab.key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{tab.icon}</svg>
                  <span>{tab.label}</span>
                </motion.button>
              ))}
              
              <div className="w-px h-8 bg-white/20 mx-2"></div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-sm text-white bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 transition-all duration-300 ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Quiz Completion Message */}
          {quizCompleted && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 bg-green-500/20 backdrop-blur-lg border border-green-500/30 rounded-3xl p-6"
            >
              <div className="flex items-center space-x-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-full">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Quiz Completed!</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-200">
                    <div>
                      <span className="font-semibold">Score:</span> {quizCompleted.score}/{quizCompleted.totalPossibleScore}
                    </div>
                    <div>
                      <span className="font-semibold">Percentage:</span> {quizCompleted.percentage}%
                    </div>
                    <div>
                      <span className="font-semibold">Time Taken:</span> {Math.floor(quizCompleted.timeTakenSeconds / 60)}m {quizCompleted.timeTakenSeconds % 60}s
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Classrooms Tab */}
            {activeTab === 'classrooms' && (
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
                <JoinClassroom />
              </div>
            )}

            {/* Submissions/Scores Tab */}
            {activeTab === 'scores' && (
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">My Scores</h2>
                {submissions.filter(sub => sub.status === 'completed').length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-purple-200">You haven't completed any quizzes yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.filter(sub => sub.status === 'completed').map((submission, index) => (
                      <motion.div 
                        key={submission._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold text-white text-lg">{submission.quizId.topic}</h3>
                            <p className="text-purple-200 text-sm">
                              Completed: {new Date(submission.submittedAt).toLocaleString()}
                            </p>
                            {submission.malpractice ? (
                              <span className="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 rounded-full bg-red-600/30 text-red-300 border border-red-500/50 text-xs font-bold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>MALPRACTICE DETECTED (Webcam Violation)</span>
                              </span>
                            ) : submission.autoSubmitted ? (
                              <span className="inline-flex items-center space-x-1 mt-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Auto-submitted (proctoring violation)</span>
                              </span>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-white">
                              {submission.score}/{submission.totalPossibleScore}
                            </div>
                            <div className={`text-sm font-medium ${
                              submission.percentage >= 80 ? 'text-green-400' :
                              submission.percentage >= 60 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {submission.percentage}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-purple-200">
                          Time taken: {Math.floor(submission.timeTakenSeconds / 60)}m {submission.timeTakenSeconds % 60}s
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quizzes Tab */}
            {activeTab === 'quizzes' && (
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">Available Quizzes</h2>
                {quizzes.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                      <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-purple-200">No quizzes have been assigned to you yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quizzes.map((quiz, index) => {
                      const isCompleted = isQuizCompleted(quiz._id);
                      const inProgress = isQuizInProgress(quiz._id);
                      const submission = getSubmissionForQuiz(quiz._id);
                      
                      return (
                        <motion.div 
                          key={quiz._id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-xl font-semibold text-white">{quiz.topic}</h3>
                            {quiz.isProctored && (
                              <span className="flex-shrink-0 ml-2 flex items-center space-x-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs px-2 py-1 rounded-full">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>Proctored</span>
                              </span>
                            )}
                          </div>
                          {quiz.description && (
                            <p className="text-purple-200 mb-4 text-sm">{quiz.description}</p>
                          )}
                          <div className="space-y-2 text-sm text-purple-200 mb-6">
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{quiz.questions.length} Questions</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                              <span>{quiz.totalPoints} Points</span>
                            </div>
                            {quiz.timeLimitMinutes && (
                              <div className="flex items-center space-x-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{quiz.timeLimitMinutes} minutes</span>
                              </div>
                            )}
                          </div>
                          
                          {isCompleted ? (
                            <div className="space-y-3">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                  {submission.score}/{submission.totalPossibleScore}
                                </div>
                                <div className={`text-sm font-medium ${
                                  submission.percentage >= 80 ? 'text-green-400' :
                                  submission.percentage >= 60 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {submission.percentage}%
                                </div>
                              </div>
                              <div className="text-center text-sm text-purple-200">
                                Completed on {new Date(submission.submittedAt).toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => startQuiz(quiz)}
                              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25"
                            >
                              {inProgress ? 'Resume Quiz' : 'Start Quiz'}
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
