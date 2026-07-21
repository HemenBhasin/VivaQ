import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Clock, Trash2, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { API_BASE } from '../apiConfig';

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
  const [error, setError] = useState(null);
  const [quizSaved, setQuizSaved] = useState(false);
  const [savedQuizId, setSavedQuizId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  // Classroom & proctoring
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassrooms, setSelectedClassrooms] = useState([]);
  const [isProctored, setIsProctored] = useState(false);
  const [isStrictProctored, setIsStrictProctored] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) fetchClassrooms(user);
    });
    return () => unsubscribe();
  }, []);

  const fetchClassrooms = async (user) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE}/api/classrooms/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassrooms(data.classrooms || []);
      }
    } catch (e) {
      console.error('Failed to fetch classrooms:', e);
    }
  };

  const toggleClassroom = (id) => {
    setSelectedClassrooms(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Function to add delay for retry
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to call the Gemini API directly from frontend with retry logic
  const generateQuestions = async (currentRetryCount = 0, isAppending = false) => {
    setError('');
    setLoading(true);
    if (!isAppending) {
      setGeneratedQuestions([]);
    }
    setQuizSaved(false);
    setSavedQuizId(null);
    setRetryCount(currentRetryCount);

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
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429 && currentRetryCount < 3) {
          // Rate limit exceeded - implement exponential backoff
          const delayMs = Math.pow(2, currentRetryCount) * 1000; // 1s, 2s, 4s
          console.log(`Rate limit hit. Retrying in ${delayMs}ms... (Attempt ${currentRetryCount + 1}/3)`);
          await sleep(delayMs);
          return generateQuestions(currentRetryCount + 1, isAppending);
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonString = result.candidates[0].content.parts[0].text;
        const parsedJson = JSON.parse(jsonString);
        if (isAppending) {
            setGeneratedQuestions(prev => [...prev, ...parsedJson]);
        } else {
            setGeneratedQuestions(parsedJson);
        }
      } else {
        setError('No questions generated. Please try again.');
      }
    } catch (err) {
      console.error('Error generating questions:', err);
      if (err.message.includes('Rate limit')) {
        setError(`${err.message} This is a temporary limitation from the API provider.`);
      } else {
        setError(`Failed to generate questions: ${err.message}. Please ensure the topic is clear and try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  
  const removeQuestion = (indexToRemove) => {
    setGeneratedQuestions(prev => prev.filter((_, index) => index !== indexToRemove));
    if (editingIndex === indexToRemove) {
      setEditingIndex(null);
      setEditFormData(null);
    } else if (editingIndex > indexToRemove) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const startEditing = (index) => {
    setEditingIndex(index);
    setEditFormData(JSON.parse(JSON.stringify(generatedQuestions[index])));
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditFormData(null);
  };

  const saveEdit = () => {
    setGeneratedQuestions(prev => {
      const updated = [...prev];
      updated[editingIndex] = editFormData;
      return updated;
    });
    setEditingIndex(null);
    setEditFormData(null);
  };

  const addManualQuestion = () => {
    const newQuestion = {
      questionText: '',
      questionType: questionType,
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false }
      ],
      correctAnswer: ''
    };
    setGeneratedQuestions(prev => {
      setEditingIndex(prev.length);
      return [...prev, newQuestion];
    });
    setEditFormData(newQuestion);
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditOptionChange = (optIndex, field, value) => {
    setEditFormData(prev => {
      const newOptions = [...prev.options];
      if (!newOptions[optIndex]) {
          newOptions[optIndex] = { text: '', isCorrect: false };
      }
      if (field === 'isCorrect' && (prev.questionType === 'MCQ' || prev.questionType === 'TrueFalse')) {
        newOptions.forEach(opt => opt.isCorrect = false);
      }
      newOptions[optIndex] = { ...newOptions[optIndex], [field]: value };
      return { ...prev, options: newOptions };
    });
  };

  const addOptionToEdit = () => {
    setEditFormData(prev => ({
        ...prev,
        options: [...(prev.options || []), { text: '', isCorrect: false }]
    }));
  };

  const removeOptionFromEdit = (optIndex) => {
      setEditFormData(prev => ({
          ...prev,
          options: prev.options.filter((_, i) => i !== optIndex)
      }));
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
        assignedTo: [],
        assignedClassrooms: selectedClassrooms,
        availabilityStart: availabilityStart ? new Date(availabilityStart).toISOString() : null,
        availabilityEnd: availabilityEnd ? new Date(availabilityEnd).toISOString() : null,
        timeLimitMinutes: timeLimitMinutes || null,
        status: 'active',
        isProctored,
        isStrictProctored
      };
      
      console.log('Sending quiz payload:', quizPayload);
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE}/api/save-quiz`, {
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
        <h1 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-purple-400 mr-3" /> AI-Powered Quiz Question Generator
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

            {/* Classroom Assignment */}
            {classrooms.length > 0 && (
              <div className="mt-6">
                <label className="block text-purple-200 text-sm font-bold mb-3">
                  Assign to Classrooms:
                  <span className="ml-2 text-purple-400 font-normal text-xs">(leave unselected to assign to all students)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {classrooms.map(c => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleClassroom(c._id)}
                      className={`flex items-center space-x-3 p-3 rounded-xl border text-left transition-all duration-200 ${
                        selectedClassrooms.includes(c._id)
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-white/20 bg-white/5 text-purple-300 hover:border-purple-400/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        selectedClassrooms.includes(c._id) ? 'border-purple-400 bg-purple-500' : 'border-white/30'
                      }`}>
                        {selectedClassrooms.includes(c._id) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-purple-400">{c.students?.length || 0} students</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Proctored Exam Toggle */}
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setIsProctored(prev => !prev)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                  isProctored
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-white/20 bg-white/5 hover:border-white/30'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isProctored ? 'bg-amber-500/20' : 'bg-white/10'
                  }`}>
                    <svg className={`w-5 h-5 ${isProctored ? 'text-amber-400' : 'text-purple-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${isProctored ? 'text-amber-300' : 'text-white'}`}>
                      Proctored Exam Mode {isProctored ? '— ON' : '— OFF'}
                    </p>
                    <p className="text-xs text-purple-400 mt-0.5">
                      Forces fullscreen, blocks tab switching. Auto-submits on 2nd violation.
                    </p>
                  </div>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${isProctored ? 'bg-amber-500' : 'bg-white/20'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${isProctored ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
              </button>
            </div>
            
            {/* Strict AI Proctoring Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl mt-4">
              <div>
                <p className={`font-semibold text-sm ${isStrictProctored ? 'text-red-400' : 'text-white'}`}>
                  Strict AI Proctoring (Webcam) {isStrictProctored ? '— ON' : '— OFF'}
                </p>
                <p className="text-xs text-purple-200 mt-1">
                  Enforces continuous webcam monitoring. Auto-submits if the student looks away for 7 seconds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsStrictProctored(!isStrictProctored)}
                className="focus:outline-none"
              >
                <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${isStrictProctored ? 'bg-red-500' : 'bg-white/20'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ${isStrictProctored ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
              </button>
            </div>

            <motion.button
              onClick={generateQuestions}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={loading || !topic.trim()}
              className={`w-full mt-[10px] py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300
                ${loading || !topic.trim() ? 'bg-white/10 text-purple-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/25 hover:shadow-xl'}`}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Generating...'}
                </div>
              ) : (
                'Generate Questions '
              )}
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
              className="mb-6 p-6 border border-white/20 rounded-2xl bg-white/5 backdrop-blur-sm relative group"
            >
              {editingIndex === index ? (
                 <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">Edit Question {index + 1}</h3>
                        <div className="flex space-x-2">
                           <button onClick={cancelEditing} className="px-3 py-1 bg-gray-500/30 hover:bg-gray-500/50 text-white rounded">Cancel</button>
                           <button onClick={saveEdit} className="px-3 py-1 bg-green-500/50 hover:bg-green-500/70 text-white rounded">Save</button>
                        </div>
                    </div>
                    
                    <input type="text" value={editFormData.questionText} onChange={e => handleEditChange('questionText', e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded text-white focus:ring-2 focus:ring-purple-500" placeholder="Question Text" />
                    
                    <select value={editFormData.questionType} onChange={e => handleEditChange('questionType', e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded text-white [&>option]:bg-gray-800">
                       <option value="MCQ">Multiple Choice</option>
                       <option value="Text">Text Answer</option>
                       <option value="Checkbox">Checkbox</option>
                       <option value="TrueFalse">True/False</option>
                    </select>

                    {['MCQ', 'Checkbox'].includes(editFormData.questionType) && (
                        <div className="space-y-2 mt-4 p-4 bg-black/20 rounded-xl border border-white/10">
                            <p className="text-sm text-purple-200 font-semibold mb-3">Options (Check correct answers):</p>
                            {(editFormData.options || []).map((opt, i) => (
                                <div key={i} className="flex items-center space-x-3 mb-2">
                                    <input type="checkbox" checked={opt.isCorrect} onChange={e => handleEditOptionChange(i, 'isCorrect', e.target.checked)} className="w-5 h-5 rounded border-purple-500 text-purple-600 focus:ring-purple-500" />
                                    <input type="text" value={opt.text} onChange={e => handleEditOptionChange(i, 'text', e.target.value)} className="flex-1 p-2 bg-white/5 border border-white/10 rounded text-white focus:ring-2 focus:ring-purple-500" placeholder={`Option ${i+1}`} />
                                    <button onClick={() => removeOptionFromEdit(i)} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            <button onClick={addOptionToEdit} className="text-sm text-purple-300 hover:text-white flex items-center space-x-1 mt-2 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                <span>Add Option</span>
                            </button>
                        </div>
                    )}
                    {['Text', 'TrueFalse'].includes(editFormData.questionType) && (
                        <div className="mt-4">
                            <p className="text-sm text-purple-200 mb-2">Correct Answer:</p>
                            <input type="text" value={editFormData.correctAnswer || ''} onChange={e => handleEditChange('correctAnswer', e.target.value)} className="w-full p-3 bg-white/10 border border-white/20 rounded text-white focus:ring-2 focus:ring-purple-500" placeholder="Correct Answer" />
                        </div>
                    )}
                 </div>
              ) : (
                 <>
                    <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditing(index)} className="p-2 bg-blue-500/20 hover:bg-blue-500/40 rounded-lg text-blue-300 transition-colors" title="Edit">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => removeQuestion(index)} className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg text-red-300 transition-colors" title="Delete">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                    <p className="font-semibold text-lg text-white mb-3 pr-16">
                      {index + 1}. {q.questionText || <span className="text-gray-400 italic">No question text</span>}
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
                 </>
              )}
            </motion.div>
          ))}
          
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
             <button
                onClick={addManualQuestion}
                disabled={editingIndex !== null}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-purple-200 bg-white/5 hover:bg-white/10 border border-purple-500/30 transition-all duration-300 flex justify-center items-center space-x-2 disabled:opacity-50"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span>Add Question Manually</span>
             </button>
             <button
                onClick={() => generateQuestions(0, true)}
                disabled={loading || !topic.trim() || editingIndex !== null}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all duration-300 flex justify-center items-center space-x-2 disabled:opacity-50"
             >
                {loading ? (
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                   </svg>
                ) : (
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
                <span>{loading ? 'Generating...' : 'Generate More AI Questions'}</span>
             </button>
          </div>
          
          <motion.button
            onClick={assignQuizToStudents}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={loading || editingIndex !== null}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 ${
               loading || editingIndex !== null 
                 ? 'bg-white/10 text-gray-400 cursor-not-allowed' 
                 : 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/25 hover:shadow-xl'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <span>{editingIndex !== null ? 'Save edits to assign' : 'Assign Quiz to Students'}</span>
            </div>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default QuizGenerator;