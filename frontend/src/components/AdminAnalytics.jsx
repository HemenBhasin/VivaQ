import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAuth } from 'firebase/auth';

const AdminAnalytics = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const auth = getAuth();

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    if (selectedQuiz) {
      fetchSubmissions(selectedQuiz._id);
    }
  }, [selectedQuiz]);

  const fetchQuizzes = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('http://localhost:5000/api/admin/quizzes', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quizzes');
      }

      const data = await response.json();
      setQuizzes(data.quizzes);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchSubmissions = async (quizId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`http://localhost:5000/api/submissions/quiz/${quizId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setSubmissions(data.submissions);
      setStatistics(data.statistics);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchSubmissionDetails = async (submissionId) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`http://localhost:5000/api/submission/${submissionId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch submission details');
      }

      const data = await response.json();
      setSelectedSubmission(data);
    } catch (err) {
      setError(err.message);
    }
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

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full"
      >
        <h1 className="text-3xl font-bold text-white mb-8 text-center">Quiz Analytics</h1>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-500/20 backdrop-blur-lg border border-red-500/30 text-white rounded-xl"
          >
            {error}
          </motion.div>
        )}

        {/* Quiz Selection */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 mb-8"
        >
          <h2 className="text-xl font-semibold text-white mb-6">Select Quiz</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz, index) => (
              <motion.div
                key={quiz._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedQuiz(quiz)}
                className={`p-6 border rounded-2xl cursor-pointer transition-all duration-300 ${
                  selectedQuiz?._id === quiz._id
                    ? 'border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/25'
                    : 'border-white/20 hover:border-purple-300/50 hover:bg-white/5'
                }`}
              >
                <h3 className="font-semibold text-white mb-3 text-lg">{quiz.topic}</h3>
                <p className="text-purple-200 text-sm mb-2">
                  Questions: {quiz.questions.length}
                </p>
                <p className="text-purple-200 text-sm mb-3">
                  Created: {new Date(quiz.createdAt).toLocaleDateString()}
                </p>
                <span className={`inline-block px-3 py-1 text-xs rounded-full ${
                  quiz.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  {quiz.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {selectedQuiz && (
          <>
            {/* Statistics */}
            {statistics && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 mb-8"
              >
                <h2 className="text-xl font-semibold text-white mb-6">Quiz Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-6 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 rounded-2xl"
                  >
                    <div className="text-3xl font-bold text-blue-400 mb-2">{statistics.totalSubmissions}</div>
                    <div className="text-sm text-blue-200">Total Submissions</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-6 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-2xl"
                  >
                    <div className="text-3xl font-bold text-green-400 mb-2">{statistics.averageScore}%</div>
                    <div className="text-sm text-green-200">Average Score</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-6 bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-2xl"
                  >
                    <div className="text-3xl font-bold text-yellow-400 mb-2">{statistics.highestScore}%</div>
                    <div className="text-sm text-yellow-200">Highest Score</div>
                  </motion.div>
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className="text-center p-6 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-2xl"
                  >
                    <div className="text-3xl font-bold text-red-400 mb-2">{statistics.lowestScore}%</div>
                    <div className="text-sm text-red-200">Lowest Score</div>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Submissions List */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 mb-8"
            >
              <h2 className="text-xl font-semibold text-white mb-6">Student Submissions</h2>
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-purple-200">No submissions yet for this quiz.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-4 px-4 font-semibold text-purple-200">Student</th>
                        <th className="text-left py-4 px-4 font-semibold text-purple-200">Score</th>
                        <th className="text-left py-4 px-4 font-semibold text-purple-200">Percentage</th>
                        <th className="text-left py-4 px-4 font-semibold text-purple-200">Time Taken</th>
                        <th className="text-left py-4 px-4 font-semibold text-purple-200">Submitted</th>
                        <th className="text-left py-4 px-4 font-semibold text-purple-200">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((submission, index) => (
                        <motion.tr 
                          key={submission._id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          className="border-b border-white/10 hover:bg-white/5 transition-all duration-300"
                        >
                          <td className="py-4 px-4 text-white">{submission.userId.email}</td>
                          <td className="py-4 px-4 text-white">{submission.score}/{submission.totalPossibleScore}</td>
                          <td className="py-4 px-4">
                            <span className={`inline-block px-3 py-1 text-xs rounded-full ${
                              submission.percentage >= 80 ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                              submission.percentage >= 60 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                              'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {submission.percentage}%
                            </span>
                          </td>
                          <td className="py-4 px-4 text-purple-200">
                            {Math.floor(submission.timeTakenSeconds / 60)}m {submission.timeTakenSeconds % 60}s
                          </td>
                          <td className="py-4 px-4 text-purple-200">
                            {new Date(submission.submittedAt).toLocaleString()}
                          </td>
                          <td className="py-4 px-4">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => fetchSubmissionDetails(submission._id)}
                              className="text-purple-400 hover:text-purple-300 font-medium transition-colors duration-300"
                            >
                              View Details
                            </motion.button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* Submission Details Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-8 border-b border-white/20">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">
                    Submission Details - {selectedSubmission.userId.email}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedSubmission(null)}
                    className="text-purple-200 hover:text-white transition-colors duration-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-purple-200">
                    <span className="font-semibold">Score:</span> {selectedSubmission.score}/{selectedSubmission.totalPossibleScore}
                  </div>
                  <div className="text-purple-200">
                    <span className="font-semibold">Percentage:</span> {selectedSubmission.percentage}%
                  </div>
                  <div className="text-purple-200">
                    <span className="font-semibold">Time Taken:</span> {Math.floor(selectedSubmission.timeTakenSeconds / 60)}m {selectedSubmission.timeTakenSeconds % 60}s
                  </div>
                  <div className="text-purple-200">
                    <span className="font-semibold">Submitted:</span> {new Date(selectedSubmission.submittedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-8">
                <h3 className="text-xl font-semibold text-white mb-6">Answers</h3>
                <div className="space-y-6">
                  {selectedSubmission.answers.map((answer, index) => {
                    const question = selectedSubmission.quizId.questions[index];
                    return (
                      <motion.div 
                        key={answer.questionId} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-white">
                            Question {index + 1}: {question.questionText}
                          </h4>
                          <span className={`inline-block px-3 py-1 text-xs rounded-full ${
                            answer.isCorrect ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {answer.isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>
                        <div className="text-sm text-purple-200 mb-2">
                          <span className="font-medium">Student's Answer:</span> {answer.answer}
                        </div>
                        {!answer.isCorrect && (
                          <div className="text-sm text-purple-200">
                            <span className="font-medium">Correct Answer:</span> {question.correctAnswer}
                          </div>
                        )}
                        <div className="text-sm text-purple-300 mt-3">
                          Points: {answer.points}/10
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminAnalytics; 