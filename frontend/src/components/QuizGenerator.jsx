import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const QuizGenerator = () => {
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [questionType, setQuestionType] = useState('MCQ');
  const [numQuestions, setNumQuestions] = useState(3);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quizSaved, setQuizSaved] = useState(false);
  const [savedQuizId, setSavedQuizId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Function to call the Gemini API directly from frontend
  const generateQuestions = async () => {
    setError('');
    setLoading(true);
    setGeneratedQuestions([]);
    setQuizSaved(false);
    setSavedQuizId(null);

    const prompt = `Generate ${numQuestions} ${questionType} questions about "${topic}".
    For MCQ and Checkbox questions, provide 3-5 options and indicate the correct one(s).
    For Text questions, provide the correct answer.
    Return the questions in a JSON array format.`;

    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    // Define the JSON schema for the expected response
    const responseSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          "questionText": { "type": "STRING" },
          "questionType": { "type": "STRING", "enum": ["MCQ", "Text", "Checkbox", "TrueFalse"] },
          "options": {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                "text": { "type": "STRING" },
                "isCorrect": { "type": "BOOLEAN" }
              },
              required: ["text"]
            }
          },
          "correctAnswer": { "type": "STRING" } // For Text/TrueFalse
        },
        required: ["questionText", "questionType"]
      }
    };

    const payload = {
      contents: chatHistory,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    };

    // API Key is expected to be provided at runtime (e.g., environment variable)
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      setLoading(false);
      setError('Gemini API key is not set in environment variables');
      return;
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        const parsedJson = JSON.parse(jsonString);
        setGeneratedQuestions(parsedJson);
      } else {
        setError('No questions generated. Please try again.');
      }
    } catch (err) {
      console.error('Error generating questions:', err);
      setError(`Failed to generate questions: ${err.message}. Please ensure the topic is clear and try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Function to transform generated questions to match Quiz model structure
  const transformQuestions = (questions) => {
    console.log('Transforming questions:', questions);
    
    return questions.map((q, index) => {
      console.log(`Processing question ${index + 1}:`, q);
      
      const transformedQuestion = {
        questionText: q.questionText,
        questionType: q.questionType,
        correctAnswer: null
      };

      if (q.questionType === 'MCQ' && q.options) {
        // For MCQ, find the correct option and set it as correctAnswer
        const correctOption = q.options.find(opt => opt.isCorrect);
        if (correctOption) {
          transformedQuestion.correctAnswer = correctOption.text;
          transformedQuestion.options = q.options.map(opt => opt.text);
        } else {
          // If no correct option found, use the first option
          transformedQuestion.correctAnswer = q.options[0].text;
          transformedQuestion.options = q.options.map(opt => opt.text);
        }
      } else if (q.questionType === 'Checkbox' && q.options) {
        // For Checkbox, find all correct options and set them as correctAnswer
        const correctOptions = q.options.filter(opt => opt.isCorrect);
        if (correctOptions.length > 0) {
          transformedQuestion.correctAnswer = correctOptions.map(opt => opt.text);
          transformedQuestion.options = q.options.map(opt => opt.text);
        } else {
          // If no correct options found, use the first option
          transformedQuestion.correctAnswer = [q.options[0].text];
          transformedQuestion.options = q.options.map(opt => opt.text);
        }
      } else if (q.questionType === 'Text' && q.correctAnswer) {
        // For Text questions, use the correctAnswer field
        transformedQuestion.correctAnswer = q.correctAnswer;
      } else if (q.questionType === 'TrueFalse' && q.correctAnswer) {
        // For TrueFalse questions, use the correctAnswer field
        transformedQuestion.correctAnswer = q.correctAnswer;
      } else {
        // Fallback: use the first option as correct answer for MCQ
        if (q.options && q.options.length > 0) {
          transformedQuestion.correctAnswer = q.options[0].text;
          transformedQuestion.options = q.options.map(opt => opt.text);
        }
      }

      // Validate that we have a correct answer
      if (!transformedQuestion.correctAnswer) {
        console.error(`Question ${index + 1} is missing a correct answer:`, q);
        throw new Error(`Question ${index + 1} is missing a correct answer`);
      }

      console.log(`Transformed question ${index + 1}:`, transformedQuestion);
      return transformedQuestion;
    });
  };

  // Function to save and assign quiz to students
  const assignQuizToStudents = async () => {
    if (generatedQuestions.length === 0) {
      setError('No generated questions to save.');
      return;
    }
    if (!currentUser) {
      setError('User not authenticated');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Transform questions to match Quiz model structure
      const transformedQuestions = transformQuestions(generatedQuestions);
      
      const quizPayload = {
        topic,
        description,
        questionType,
        questions: transformedQuestions,
        assignedTo: [], // For now, assign to all students; can be extended to specific users
        availabilityStart: availabilityStart ? new Date(availabilityStart).toISOString() : null,
        availabilityEnd: availabilityEnd ? new Date(availabilityEnd).toISOString() : null,
        timeLimitMinutes: timeLimitMinutes || null,
        status: 'active'
      };
      
      console.log('Sending quiz payload:', quizPayload);
      
      const token = await currentUser.getIdToken();
      const response = await fetch('http://localhost:5000/api/save-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(quizPayload)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to save quiz: ${response.statusText}`);
      }
      const data = await response.json();
      setQuizSaved(true);
      setSavedQuizId(data.quiz._id);
    } catch (err) {
      console.error('Error saving quiz:', err);
      setError(`Failed to save quiz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to create a test quiz (for debugging)
  const createTestQuiz = async () => {
    if (!currentUser) {
      setError('User not authenticated');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const testQuestions = [
        {
          questionText: "What is 2 + 2?",
          questionType: "MCQ",
          correctAnswer: "4",
          options: ["3", "4", "5", "6"]
        },
        {
          questionText: "Is the sky blue?",
          questionType: "TrueFalse",
          correctAnswer: "true"
        }
      ];
      
      const quizPayload = {
        topic: "Test Quiz",
        description: "A simple test quiz",
        questionType: "MCQ",
        questions: testQuestions,
        assignedTo: [],
        availabilityStart: null,
        availabilityEnd: null,
        timeLimitMinutes: 10,
        status: 'active'
      };
      
      console.log('Sending test quiz payload:', quizPayload);
      
      const token = await currentUser.getIdToken();
      const response = await fetch('http://localhost:5000/api/save-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(quizPayload)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to save quiz: ${response.statusText}`);
      }
      const data = await response.json();
      setQuizSaved(true);
      setSavedQuizId(data.quiz._id);
    } catch (err) {
      console.error('Error saving test quiz:', err);
      setError(`Failed to save test quiz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Framer Motion variants for staggered list entry
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full"
      >
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          ✨ AI-Powered Quiz Question Generator
        </h1>

        {quizSaved ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 text-center"
          >
            <div className="bg-green-500/20 backdrop-blur-lg border border-green-500/30 rounded-3xl p-6 mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400 font-semibold text-lg mb-4">Quiz saved and assigned successfully!</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setQuizSaved(false);
                  setGeneratedQuestions([]);
                  setSavedQuizId(null);
                  setTopic('');
                  setDescription('');
                  setTimeLimitMinutes(30);
                  setAvailabilityStart('');
                  setAvailabilityEnd('');
                }}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-red-500/25 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create New Quiz</span>
                </div>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="mb-6">
              <label htmlFor="topic" className="block text-purple-200 text-sm font-bold mb-3">
                Topic:
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., World War II history, Basic Algebra"
                className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white placeholder-purple-300 leading-tight"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="description" className="block text-purple-200 text-sm font-bold mb-3">
                Description (Optional):
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the quiz..."
                className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white placeholder-purple-300 leading-tight"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="questionType" className="block text-purple-200 text-sm font-bold mb-3">
                  Question Type:
                </label>
                <select
                  id="questionType"
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white"
                >
                  <option value="MCQ">Multiple Choice</option>
                  <option value="Text">Text Answer</option>
                  <option value="Checkbox">Checkbox</option>
                  <option value="TrueFalse">True/False</option>
                </select>
              </div>
              <div>
                <label htmlFor="numQuestions" className="block text-purple-200 text-sm font-bold mb-3">
                  Number of Questions:
                </label>
                <input
                  type="number"
                  id="numQuestions"
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="10"
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label htmlFor="timeLimit" className="block text-purple-200 text-sm font-bold mb-3">
                  Time Limit (minutes):
                </label>
                <input
                  type="number"
                  id="timeLimit"
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="180"
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="availabilityStart" className="block text-purple-200 text-sm font-bold mb-3">
                  Available From:
                </label>
                <input
                  type="datetime-local"
                  id="availabilityStart"
                  value={availabilityStart}
                  onChange={(e) => setAvailabilityStart(e.target.value)}
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="availabilityEnd" className="block text-purple-200 text-sm font-bold mb-3">
                  Available Until:
                </label>
                <input
                  type="datetime-local"
                  id="availabilityEnd"
                  value={availabilityEnd}
                  onChange={(e) => setAvailabilityEnd(e.target.value)}
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 backdrop-blur-sm text-white"
                />
              </div>
            </div>

            <motion.button
              onClick={generateQuestions}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading || !topic.trim()}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300
                ${loading || !topic.trim() ? 'bg-white/10 text-purple-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/25 hover:shadow-xl'}`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </div>
              ) : (
                'Generate Questions ✨'
              )}
            </motion.button>

            {/* Test button for debugging */}
            <motion.button
              onClick={createTestQuiz}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading}
              className="w-full mt-6 py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/25 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create Test Quiz (Debug)</span>
              </div>
            </motion.button>
          </>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-4 bg-red-500/20 backdrop-blur-lg border border-red-500/30 text-white rounded-xl text-center"
          >
            {error}
          </motion.div>
        )}
      </motion.div>

      {generatedQuestions.length > 0 && !quizSaved && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 w-full mt-8"
        >
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Generated Questions</h2>
          {generatedQuestions.map((q, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="mb-6 p-6 border border-white/20 rounded-2xl bg-white/5 backdrop-blur-sm"
            >
              <p className="font-semibold text-lg text-white mb-3">
                {index + 1}. {q.questionText}
              </p>
              <p className="text-sm text-purple-200 mb-3">Type: {q.questionType}</p>
              {q.options && q.options.length > 0 && (
                <ul className="list-disc list-inside ml-4 text-purple-200">
                  {q.options.map((option, optIndex) => (
                    <li key={optIndex} className={`${option.isCorrect ? 'font-medium text-green-400' : ''}`}>
                      {option.text} {option.isCorrect && '(Correct)'}
                    </li>
                  ))}
                </ul>
              )}
              {q.correctAnswer && (
                <p className="text-purple-200 mt-3">
                  <span className="font-medium">Correct Answer:</span> {q.correctAnswer}
                </p>
              )}
            </motion.div>
          ))}
          <motion.button
            onClick={assignQuizToStudents}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={loading}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/25 hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span>Assign Quiz to Students</span>
            </div>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default QuizGenerator;