import { auth } from '../firebaseConfig';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../apiConfig';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Camera, Download, BrainCircuit, CheckCircle2, AlertTriangle } from 'lucide-react';

const QuizTaker = ({ quizId, onComplete }) => {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [initialTimeTaken, setInitialTimeTaken] = useState(0);

  // Proctoring state
  const [quizStarted, setQuizStarted] = useState(false);      // true = fullscreen entered, quiz is live
  const [warnings, setWarnings] = useState(0);                // 0 or 1
  const [warningType, setWarningType] = useState(null);       // 'fullscreen' | 'tab'
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const proctoringActive = quiz?.isProctored && quizStarted;
  const warningsRef = useRef(0);  // ref for use inside event handlers
  const submittingRef = useRef(false);
  const isRequestingFullscreenRef = useRef(false);

  // Strict Proctoring (Webcam)
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const timeAwayRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const [webcamReady, setWebcamReady] = useState(false);
  const [isInitializingWebcam, setIsInitializingWebcam] = useState(false);
  const [modelLoadStep, setModelLoadStep] = useState(null);  // describes current init stage
  const [isFaceWarningActive, setIsFaceWarningActive] = useState(false);
  const faceWarningActiveRef = useRef(false);

  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  useEffect(() => {
    if (quiz && quiz.timeLimitMinutes) {
      setTimeLeft(quiz.timeLimitMinutes * 60);
      setStartTime(Date.now());
    }
  }, [quiz]);

  // Timer
  useEffect(() => {
    if (timeLeft > 0 && startTime && quizStarted) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSubmit(false, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, startTime, quizStarted]);

  // ── Proctoring event listeners ───────────────────────────────────────────
  const handleViolation = useCallback((type) => {
    if (!quiz?.isProctored || submittingRef.current) return;

    const currentWarnings = warningsRef.current;
    if (currentWarnings < 2) {
      // First and second violation → show warning
      warningsRef.current += 1;
      setWarnings(warningsRef.current);
      setWarningType(type);
      setShowWarningModal(true);
    } else {
      // Third violation → auto-submit
      submittingRef.current = true;
      setAutoSubmitting(true);
      setShowWarningModal(false);
      handleSubmit(true, 2, false);
    }
  }, [quiz]);

  // Fullscreen change
  useEffect(() => {
    if (!proctoringActive) return;

    const onFsChange = () => {
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      if (!isFullscreen) handleViolation('fullscreen');
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
    };
  }, [proctoringActive, handleViolation]);

  // Tab / window switch
  useEffect(() => {
    if (!proctoringActive) return;

    const onVisibilityChange = () => {
      if (isRequestingFullscreenRef.current) return;
      if (document.hidden) handleViolation('tab');
    };
    const onBlur = () => {
      if (isRequestingFullscreenRef.current) return;
      handleViolation('tab');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [proctoringActive, handleViolation]);

  // ── AI Face Detection Loop (MediaPipe FaceLandmarker) ───────────────────
  const detectFace = useCallback(() => {
    if (!videoRef.current || !detectorRef.current || submittingRef.current || !quizStarted) return;

    try {
      if (videoRef.current.readyState === 4) {
        const now = performance.now();
        const delta = now - lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;

        // detectForVideo is synchronous in MediaPipe tasks-vision
        const results = detectorRef.current.detectForVideo(videoRef.current, now);

        let isLookingAway = false;
        let reason = '';

        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
          isLookingAway = true;
          reason = 'No face detected';
        } else {
          // ── 1. HEAD POSE via rotation matrix ─────────────────────────────
          // Column-major 4x4 matrix. Euler extraction (XYZ convention):
          //   yaw   = asin(-m[8])      → turning left/right
          //   pitch = atan2(m[9],m[10]) → looking up/down
          if (results.facialTransformationMatrixes?.length > 0) {
            const m = results.facialTransformationMatrixes[0].data;
            const yawDeg   = Math.asin(Math.max(-1, Math.min(1, -m[8]))) * (180 / Math.PI);
            const pitchDeg = Math.atan2(m[9], m[10]) * (180 / Math.PI);
            console.log(`[Proctor] Head → yaw=${yawDeg.toFixed(1)}° pitch=${pitchDeg.toFixed(1)}°`);

            if (Math.abs(yawDeg) > 22) {
              isLookingAway = true;
              reason = `Head turned ${yawDeg.toFixed(1)}°`;
            } else if (pitchDeg > 20) {
              isLookingAway = true;
              reason = `Head pitched down ${pitchDeg.toFixed(1)}°`;
            }
          }

          // ── 2. EYE GAZE via blendshapes (catches eye flicks even if head is still) ─
          if (!isLookingAway && results.faceBlendshapes?.length > 0) {
            const shapes = results.faceBlendshapes[0].categories;
            const get = (name) => shapes.find(s => s.categoryName === name)?.score ?? 0;

            const outL  = get('eyeLookOutLeft');
            const outR  = get('eyeLookOutRight');
            const downL = get('eyeLookDownLeft');
            const downR = get('eyeLookDownRight');
            console.log(`[Proctor] Eyes → outL=${outL.toFixed(2)} outR=${outR.toFixed(2)} downL=${downL.toFixed(2)} downR=${downR.toFixed(2)}`);

            // One eye strongly deviating outward = looking sideways without turning head
            // Both eyes looking down = reading phone/notes on lap
            if (outL > 0.45 || outR > 0.45) {
              isLookingAway = true;
              reason = `Eyes looking sideways (outL=${outL.toFixed(2)} outR=${outR.toFixed(2)})`;
            } else if (downL > 0.50 && downR > 0.50) {
              isLookingAway = true;
              reason = `Eyes looking down (downL=${downL.toFixed(2)} downR=${downR.toFixed(2)})`;
            }
          }
        }

        if (isLookingAway) console.log(`[Proctor] ⚠ Away: ${reason}`);

        if (isLookingAway) {
          timeAwayRef.current += delta;

          if (timeAwayRef.current >= 3000 && timeAwayRef.current < 7000) {
            if (!faceWarningActiveRef.current) {
              faceWarningActiveRef.current = true;
              setIsFaceWarningActive(true);
            }
          }

          if (timeAwayRef.current >= 7000 && !submittingRef.current) {
            console.warn('[Proctor] Away for 7s — auto-submitting as malpractice');
            submittingRef.current = true;
            setAutoSubmitting(true);
            handleSubmit(true, 0, true);
            return;
          }
        } else {
          timeAwayRef.current = 0;
          if (faceWarningActiveRef.current) {
            faceWarningActiveRef.current = false;
            setIsFaceWarningActive(false);
          }
        }
      }
    } catch (e) {
      console.error('[Proctor] Detection error:', e);
    }

    if (!submittingRef.current) {
      requestAnimationFrame(detectFace);
    }
  }, [quizStarted]);

  useEffect(() => {
    if (quizStarted && quiz?.isStrictProctored && webcamReady) {
      lastFrameTimeRef.current = performance.now();
      if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
        videoRef.current.srcObject = streamRef.current;
      }
      detectFace();
    }
  }, [quizStarted, quiz, webcamReady, detectFace]);

  // Cleanup webcam and model
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (detectorRef.current) {
        detectorRef.current.close(); // MediaPipe uses close() not dispose()
      }
    };
  }, []);

  // ── Auto Save Logic ────────────────────────────────────────────────────
  const handleSaveProgress = useCallback(async () => {
    if (submitting || !quizStarted) return;
    try {
      const currentTimeTaken = initialTimeTaken + (startTime ? Math.floor((Date.now() - startTime) / 1000) : 0);
      const answersArray = Object.keys(answers).map(qId => ({
        questionId: qId,
        answer: answers[qId]
      }));

      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_BASE}/api/save-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quizId,
          answers: answersArray,
          timeTakenSeconds: currentTimeTaken
        })
      });
      console.log('Progress auto-saved at', new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error auto-saving progress:', err);
    }
  }, [submitting, quizStarted, answers, initialTimeTaken, startTime, quizId]);

  useEffect(() => {
    if (quizStarted && !submitting) {
      const interval = setInterval(handleSaveProgress, 10000);
      return () => clearInterval(interval);
    }
  }, [quizStarted, submitting, handleSaveProgress]);

  const handleSaveAndExit = async () => {
    setSubmitting(true);
    await handleSaveProgress();
    onComplete({ score: 0, totalPossibleScore: quiz?.totalPoints || 0, percentage: 0, timeTakenSeconds: 0, status: 'in-progress' });
  };

  // ── Enter fullscreen & start quiz ────────────────────────────────────────
  const enterFullscreenAndStart = async () => {
    if (quiz?.isStrictProctored) {
      setIsInitializingWebcam(true);
      try {
        // Step 1: Get webcam stream
        setModelLoadStep({ id: 'camera', text: 'Requesting camera access...' });
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Step 2: Download MediaPipe WASM runtime (cached after first load)
        setModelLoadStep({ id: 'download', text: 'Downloading AI model... (first time only, ~2MB)' });
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        // Step 3: Initialize FaceLandmarker
        setModelLoadStep({ id: 'init', text: 'Initializing face detection AI...' });
        detectorRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,              // eye gaze detection
          outputFacialTransformationMatrixes: true, // head pose detection
          runningMode: 'VIDEO',
          numFaces: 1
        });

        setModelLoadStep({ id: 'ready', text: 'Ready!' });
        setWebcamReady(true);
      } catch (err) {
        console.error('Failed to initialize webcam or MediaPipe:', err);
        setError('Camera permission is required for strict proctored quizzes. Please allow camera access and try again.');
        setIsInitializingWebcam(false);
        setModelLoadStep('');
        return;
      }
      setIsInitializingWebcam(false);
      setModelLoadStep('');
    }

    if (quiz?.isProctored) {
      try {
        isRequestingFullscreenRef.current = true;
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
      } catch (e) {
        console.warn('Could not enter fullscreen:', e);
      } finally {
        setTimeout(() => { isRequestingFullscreenRef.current = false; }, 1000);
      }
    }
    
    setQuizStarted(true);
    setStartTime(Date.now());
    if (quiz?.timeLimitMinutes) {
      setTimeLeft(quiz.timeLimitMinutes * 60 - initialTimeTaken);
    }
  };

  // Resume after warning: re-enter fullscreen
  const handleResumeAfterWarning = async () => {
    if (quiz?.isProctored) {
      try {
        isRequestingFullscreenRef.current = true;
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } catch (e) {
      } finally {
        setTimeout(() => { isRequestingFullscreenRef.current = false; }, 1000);
      }
    }
    setShowWarningModal(false);
  };

  // Enforce fullscreen when clicking Next
  const handleNextQuestion = async () => {
    if (quiz?.isProctored) {
      const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      if (!isFullscreen) {
        try {
          isRequestingFullscreenRef.current = true;
          const el = document.documentElement;
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
          else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
        } catch (e) {
          console.warn('Could not enter fullscreen:', e);
        } finally {
          setTimeout(() => { isRequestingFullscreenRef.current = false; }, 1000);
        }
      }
    }
    setCurrentQuestion(prev => prev + 1);
  };

  // ── Fetch quiz ─────────────────────────────────────────────────────────
  const fetchQuiz = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/quiz/${quizId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch quiz');
      const data = await response.json();
      setQuiz(data.quiz);

      if (data.existingSubmission) {
        const initialAnswers = {};
        data.existingSubmission.answers.forEach(a => {
          initialAnswers[a.questionId] = a.answer;
        });
        setAnswers(initialAnswers);
        setInitialTimeTaken(data.existingSubmission.timeTakenSeconds || 0);
      }

      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // ── Submit quiz ────────────────────────────────────────────────────────
  const handleSubmit = async (autoSubmitted = false, violationsCount = 0, isMalpractice = false) => {
    if (submitting && !autoSubmitted) return;
    if (!autoSubmitted) setSubmitting(true);
    setError('');

    // Stop webcam if running
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Exit fullscreen on submit
    try {
      if (document.exitFullscreen) document.exitFullscreen();
    } catch (e) {}

    try {
      const timeTakenSeconds = initialTimeTaken + (startTime
        ? Math.floor((Date.now() - startTime) / 1000)
        : 0);

      const answersArray = quiz.questions.map((q, i) => ({
        questionId: q._id,
        answer: answers[q._id] ?? ''
      }));

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`${API_BASE}/api/submit-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quizId,
          answers: answersArray,
          timeTakenSeconds: timeTakenSeconds || 1,
          autoSubmitted,
          violations: violationsCount,
          malpractice: isMalpractice
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      onComplete({ ...result.submission, autoSubmitted });
    } catch (err) {
      console.error('Error submitting quiz:', err);
      if (!autoSubmitted) {
        setError(err.message);
        setSubmitting(false);
      } else {
        // Still navigate away on auto-submit failure
        onComplete({ score: 0, totalPossibleScore: quiz?.totalPoints || 0, percentage: 0, timeTakenSeconds: 0, autoSubmitted: true });
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Loading & Error states ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 max-w-md w-full text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-purple-200 mb-6">{error}</p>
          <button onClick={() => window.history.back()} className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold py-3 px-6 rounded-xl">
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Pre-start overlay (proctored exams only) ──────────────────────────
  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 shadow-2xl border border-white/20 max-w-lg w-full text-center"
        >
          {quiz?.isProctored ? (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-2xl mb-6">
                <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">{quiz.topic}</h2>
              <p className="text-amber-300 font-semibold mb-6 text-lg">Proctored Exam</p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-8 text-left space-y-3">
                <p className="text-amber-300 font-semibold flex items-center space-x-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Exam Rules</span>
                </p>
                <ul className="text-purple-200 text-sm space-y-2 ml-7 list-disc">
                  <li>The exam will open in <strong className="text-white">fullscreen mode</strong>.</li>
                  <li>Do <strong className="text-white">not</strong> switch tabs, windows, or exit fullscreen.</li>
                  <li>You will receive <strong className="text-white">1 warning</strong> on your first violation.</li>
                  <li>On the <strong className="text-red-400">2nd violation</strong>, the quiz will <strong className="text-red-400">automatically submit</strong> with your current answers.</li>
                </ul>
              </div>
              <div className="flex items-center justify-between text-sm text-purple-300 mb-8">
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{quiz.questions?.length} Questions</span>
                </span>
                {quiz.timeLimitMinutes && (
                  <span className="flex items-center space-x-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{quiz.timeLimitMinutes} min limit</span>
                  </span>
                )}
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>{quiz.totalPoints} pts</span>
                </span>
              </div>
              {isInitializingWebcam ? (
                <div className="w-full py-4 px-8 bg-gradient-to-r from-amber-500/60 to-orange-500/60 text-white font-bold text-lg rounded-2xl shadow-lg flex flex-col items-center space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Preparing Proctored Exam...</span>
                  </div>
                  {modelLoadStep && (
                    <div className="flex items-center space-x-2 text-sm text-amber-100 font-normal">
                      {modelLoadStep.id === 'camera' && <Camera className="w-4 h-4" />}
                      {modelLoadStep.id === 'download' && <Download className="w-4 h-4" />}
                      {modelLoadStep.id === 'init' && <BrainCircuit className="w-4 h-4" />}
                      {modelLoadStep.id === 'ready' && <CheckCircle2 className="w-4 h-4" />}
                      <span>{modelLoadStep.text}</span>
                    </div>
                  )}
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={enterFullscreenAndStart}
                  className="w-full py-4 px-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-amber-500/30"
                >
                  Enter Fullscreen &amp; Start Exam
                </motion.button>
              )}
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/20 rounded-2xl mb-6">
                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">{quiz?.topic}</h2>
              {quiz?.description && <p className="text-purple-200 mb-4">{quiz.description}</p>}
              <div className="flex items-center justify-center space-x-6 text-sm text-purple-300 mb-8">
                <span>{quiz?.questions?.length} Questions</span>
                {quiz?.timeLimitMinutes && <span>{quiz.timeLimitMinutes} min</span>}
                <span>{quiz?.totalPoints} pts</span>
              </div>
              {isInitializingWebcam ? (
                <div className="w-full py-4 px-8 bg-gradient-to-r from-purple-500/60 to-blue-500/60 text-white font-bold text-lg rounded-2xl shadow-lg flex flex-col items-center space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Preparing AI Proctor...</span>
                  </div>
                  {modelLoadStep && (
                    <div className="flex items-center space-x-2 text-sm text-purple-100 font-normal">
                      {modelLoadStep.id === 'camera' && <Camera className="w-4 h-4" />}
                      {modelLoadStep.id === 'download' && <Download className="w-4 h-4" />}
                      {modelLoadStep.id === 'init' && <BrainCircuit className="w-4 h-4" />}
                      {modelLoadStep.id === 'ready' && <CheckCircle2 className="w-4 h-4" />}
                      <span>{modelLoadStep.text}</span>
                    </div>
                  )}
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={enterFullscreenAndStart}
                  className="w-full py-4 px-8 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold text-lg rounded-2xl shadow-lg shadow-purple-500/25"
                >
                  Start Quiz
                </motion.button>
              )}
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Auto-submit overlay ───────────────────────────────────────────────
  if (autoSubmitting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-3xl p-10 shadow-2xl border border-red-500/30 max-w-md w-full text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Exam Auto-Submitted</h2>
          <p className="text-red-300 mb-2">A second proctoring violation was detected.</p>
          <p className="text-purple-300 text-sm">Your answers have been submitted and marks calculated for questions you completed.</p>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mt-6"
          />
        </motion.div>
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Strict Proctoring Webcam PIP */}
      {quizStarted && quiz?.isStrictProctored && (
        <div className="fixed bottom-6 right-6 z-[100] overflow-hidden rounded-2xl shadow-2xl border-2 border-red-500/50 bg-black" style={{ width: '160px', height: '120px' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <div className="absolute top-1 left-2 flex items-center space-x-1">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
             <span className="text-[10px] text-white font-bold bg-black/50 px-1 rounded">REC</span>
          </div>
        </div>
      )}

      {/* Face Warning Overlay */}
      <AnimatePresence>
        {isFaceWarningActive && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-[110] bg-red-600/95 text-white px-6 py-4 flex items-center justify-center space-x-4 shadow-2xl backdrop-blur-md border-b border-red-500"
          >
            <svg className="w-8 h-8 animate-pulse flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-xl font-bold">WARNING: Face not detected or looking away!</h3>
              <p className="text-red-100 font-medium">Please look directly at the screen. Quiz will automatically submit if this continues.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-blob animation-delay-2000" />
      </div>

      {/* Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              className="bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/20 rounded-full mb-5"
              >
                <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 mr-2 text-amber-500" />
                Warning! ({warnings} of 2)
              </h2>
              <p className="text-amber-300 font-medium mb-2">
                {warningType === 'fullscreen' ? 'You exited fullscreen mode.' : 'You switched away from the exam tab/window.'}
              </p>
              <p className="text-purple-200 text-sm mb-6">
                This is your <strong className="text-white">warning {warnings} of 2</strong>. After 2 warnings, your exam will be <strong className="text-red-400">automatically submitted</strong> on the next violation.
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleResumeAfterWarning}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-2xl shadow-lg"
              >
                I Understand — Resume Exam
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-2xl border border-white/20"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <h1 className="text-3xl font-bold text-white">{quiz.topic}</h1>
                  {quiz.isProctored && (
                    <span className="flex items-center space-x-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Proctored</span>
                    </span>
                  )}
                </div>
                {quiz.description && <p className="text-purple-200 mt-1">{quiz.description}</p>}
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

            {/* Warning indicator */}
            {quiz.isProctored && (
              <div className={`flex items-center space-x-2 text-sm px-3 py-1.5 rounded-lg w-fit ${
                warnings > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'
              }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Proctoring Active — Warnings: {warnings}/1</span>
              </div>
            )}

            <div className="flex justify-between items-center text-purple-200 mt-3">
              <p className="text-lg">Question {currentQuestion + 1} of {quiz.questions.length}</p>
              <p className="text-lg">Total: {quiz.totalPoints} pts</p>
            </div>
          </motion.div>

          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 shadow-2xl border border-white/20"
          >
            <div className="w-full bg-white/10 rounded-full h-3 mb-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full shadow-lg"
              />
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
            <h2 className="text-xl font-semibold text-white mb-6">{currentQ.questionText}</h2>

            <div className="space-y-4">
              {currentQ.questionType === 'MCQ' && currentQ.options && (
                currentQ.options.map((option, index) => (
                  <label
                    key={index}
                    className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                      answers[currentQ._id] === option
                        ? 'border-purple-500 bg-purple-500/20 text-white'
                        : 'border-white/20 text-purple-200 hover:bg-white/10'
                    }`}
                  >
                    <input type="radio" name={`q-${currentQ._id}`} value={option}
                      checked={answers[currentQ._id] === option}
                      onChange={e => handleAnswerChange(currentQ._id, e.target.value)}
                      className="mr-3 accent-purple-500"
                    />
                    <span>{option}</span>
                  </label>
                ))
              )}

              {currentQ.questionType === 'TrueFalse' && (
                <div className="grid grid-cols-2 gap-4">
                  {['true', 'false'].map(val => (
                    <label key={val}
                      className={`flex items-center justify-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                        answers[currentQ._id] === val
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-white/20 text-purple-200 hover:bg-white/10'
                      }`}
                    >
                      <input type="radio" name={`q-${currentQ._id}`} value={val}
                        checked={answers[currentQ._id] === val}
                        onChange={e => handleAnswerChange(currentQ._id, e.target.value)}
                        className="mr-3 accent-purple-500"
                      />
                      <span className="font-medium capitalize">{val}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQ.questionType === 'Checkbox' && currentQ.options && (
                <div className="space-y-3">
                  {currentQ.options.map((option, optIndex) => {
                    const optText = typeof option === 'string' ? option : option.text;
                    const selected = answers[currentQ._id]?.includes(optText) || false;
                    return (
                      <label key={optIndex}
                        className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                          selected ? 'border-purple-500 bg-purple-500/20 text-white' : 'border-white/20 text-purple-200 hover:bg-white/10'
                        }`}
                      >
                        <input type="checkbox" value={optText}
                          checked={selected}
                          onChange={e => {
                            const cur = answers[currentQ._id] || [];
                            handleAnswerChange(currentQ._id,
                              e.target.checked ? [...cur, optText] : cur.filter(a => a !== optText)
                            );
                          }}
                          className="mr-3 accent-purple-500"
                        />
                        <span>{optText}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {currentQ.questionType === 'Text' && (
                <textarea
                  value={answers[currentQ._id] || ''}
                  onChange={e => handleAnswerChange(currentQ._id, e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 text-white placeholder-white/30"
                  rows="4"
                />
              )}

              {currentQ.questionType === 'Numeric' && (
                <input
                  type="number"
                  value={answers[currentQ._id] || ''}
                  onChange={e => handleAnswerChange(currentQ._id, e.target.value)}
                  placeholder="Enter a number..."
                  className="w-full p-4 border border-white/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5 text-white placeholder-white/30"
                />
              )}
            </div>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20"
          >
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                disabled={currentQuestion === 0}
                className={`px-6 py-3 rounded-xl font-semibold ${
                  currentQuestion === 0
                    ? 'bg-white/10 text-purple-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                Previous
              </button>

              <div className="flex space-x-4">
                <button
                  onClick={handleSaveAndExit}
                  disabled={submitting}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-colors"
                >
                  Save & Exit
                </button>
                {currentQuestion < quiz.questions.length - 1 ? (
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
                  >
                    Next
                  </button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSubmit(false, 0)}
                    disabled={submitting}
                    className={`px-8 py-3 font-semibold rounded-xl ${
                      submitting
                        ? 'bg-white/10 text-purple-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                    }`}
                  >
                    {submitting ? 'Submitting...' : 'Submit Quiz'}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 text-white rounded-xl">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizTaker;