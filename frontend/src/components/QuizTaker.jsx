import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAuth } from 'firebase/auth';

const QuizTaker = ({ quizId, onComplete }) => {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState(null);

  const auth = getAuth();

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quiz && quiz.timeLimitMinutes) {
      setTimeLeft(quiz.timeLimitMinutes * 60);
      setStartTime(Date.now());
    }
  }, [quiz]);

  useEffect(() => {
    if (timeLeft > 0 && startTime) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft, startTime]);

  const fetchQuiz = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/quiz/${quizId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quiz');
      }

      const data = await response.json();
      setQuiz(data.quiz);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const timeTakenSeconds = Math.floor((Date.now() - startTime) / 1000);
      const answersArray = Object.keys(answers).map(questionId => ({
        questionId,
        answer: answers[questionId]
      }));

      console.log('Submitting quiz:', {
        quizId,
        answersCount: answersArray.length,
        timeTakenSeconds,
        answers: answersArray
      });

      const token = await auth.currentUser?.getIdToken();
      console.log('Token present:', !!token);

      const response = await fetch('https://vivaq-production.up.railway.app/api/submit-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          quizId,
          answers: answersArray,
          timeTakenSeconds
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Quiz submitted successfully:', result);
      onComplete(result.submission);
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
              onClick={() => window.history.back()}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/25"
            >
              Go Back
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 max-w-md w-full"
        >
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Quiz Not Found</h2>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.history.back()}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/25"
            >
              Go Back
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>

      <div className="relative z-10 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-2xl border border-white/20"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-white">{quiz.topic}</h1>
                {quiz.description && (
                  <p className="text-purple-200 mt-2">{quiz.description}</p>
                )}
              </div>
              {quiz.timeLimitMinutes && (
                <motion.div 
                  animate={timeLeft < 300 ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: timeLeft < 300 ? Infinity : 0 }}
                  className={`text-2xl font-bold px-6 py-3 rounded-2xl backdrop-blur-lg ${
                    timeLeft < 300 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}
                >
                  {formatTime(timeLeft)}
                </motion.div>
              )}
            </div>
            <div className="flex justify-between items-center text-purple-200">
              <p className="text-lg">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </p>
              <p className="text-lg">
                Total Points: {quiz.totalPoints}
              </p>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-2xl border border-white/20"
          >
            <div className="w-full bg-white/10 rounded-full h-3 mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full shadow-lg"
              ></motion.div>
            </div>
            <div className="flex justify-between text-sm text-purple-200">
              <span>Progress</span>
              <span>{Math.round(((currentQuestion + 1) / quiz.questions.length) * 100)}%</span>
            </div>
          </motion.div>

          {/* Question */}
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-6 shadow-2xl border border-white/20"
          >
            <h2 className="text-xl font-semibold text-white mb-6">
              {currentQ.questionText}
            </h2>

            {/* Answer Options */}
            <div className="space-y-4">
              {currentQ.questionType === 'MCQ' && currentQ.options && (
                currentQ.options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/20 transition-colors"
                  >
                    <input
                      type="radio"
                      name={`question-${currentQ._id}`}
                      value={option}
                      checked={answers[currentQ._id] === option}
                      onChange={(e) => handleAnswerChange(currentQ._id, e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-purple-200">{option}</span>
                  </label>
                ))
              )}

              {currentQ.questionType === 'TrueFalse' && (
                <div className="space-y-4">
                  <label className="flex items-center p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/20 transition-colors">
                    <input
                      type="radio"
                      name={`question-${currentQ._id}`}
                      value="true"
                      checked={answers[currentQ._id] === 'true'}
                      onChange={(e) => handleAnswerChange(currentQ._id, e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-purple-200">True</span>
                  </label>
                  <label className="flex items-center p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/20 transition-colors">
                    <input
                      type="radio"
                      name={`question-${currentQ._id}`}
                      value="false"
                      checked={answers[currentQ._id] === 'false'}
                      onChange={(e) => handleAnswerChange(currentQ._id, e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-purple-200">False</span>
                  </label>
                </div>
              )}

              {currentQ.questionType === 'Checkbox' && (
                <div className="space-y-4">
                  {currentQ.options && currentQ.options.length > 0 && (
                    <ul className="list-disc list-inside ml-4 text-purple-200">
                      {currentQ.options.map((option, optIndex) => (
                        <li key={optIndex} className={`${option.isCorrect ? 'font-medium text-green-400' : ''}`}>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              value={option.text}
                              checked={answers[currentQ._id]?.includes(option.text) || false}
                              onChange={(e) => {
                                const currentAnswers = answers[currentQ._id] || [];
                                if (e.target.checked) {
                                  setAnswers(prev => ({
                                    ...prev,
                                    [currentQ._id]: [...currentAnswers, option.text]
                                  }));
                                } else {
                                  setAnswers(prev => ({
                                    ...prev,
                                    [currentQ._id]: currentAnswers.filter(ans => ans !== option.text)
                                  }));
                                }
                              }}
                              className="mr-2"
                            />
                            <span>{option.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  {currentQ.correctAnswer && (
                    <p className="text-purple-200 mt-2">
                      <span className="font-medium">Correct Answer:</span> {
                        Array.isArray(currentQ.correctAnswer) 
                          ? currentQ.correctAnswer.join(', ') 
                          : currentQ.correctAnswer
                      }
                    </p>
                  )}
                </div>
              )}

              {currentQ.questionType === 'Text' && (
                <textarea
                  value={answers[currentQ._id] || ''}
                  onChange={(e) => handleAnswerChange(currentQ._id, e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full p-4 border border-white/20 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows="4"
                />
              )}
            </div>
          </motion.div>

          {/* Navigation */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20"
          >
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className={`px-6 py-3 rounded-lg font-semibold ${
                  currentQuestion === 0
                    ? 'bg-white/10 text-purple-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                Previous
              </button>

              <div className="flex space-x-4">
                {currentQuestion < quiz.questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestion(prev => prev + 1)}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`px-6 py-3 font-semibold rounded-lg ${
                      submitting
                        ? 'bg-white/10 text-purple-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {submitting ? 'Submitting...' : 'Submit Quiz'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 text-white rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizTaker; 