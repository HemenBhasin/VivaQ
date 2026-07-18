import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebaseConfig';
import { API_BASE } from '../apiConfig';

const JoinClassroom = ({ onJoined }) => {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchMyClassrooms();
    // Auto-fill join code from URL param
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) setJoinCode(code.toUpperCase());
  }, []);

  const fetchMyClassrooms = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE}/api/classrooms/student`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setClassrooms(data.classrooms || []);
    } catch (e) {
      console.error('Failed to fetch classrooms:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE}/api/classrooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ joinCode: joinCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccessMsg(data.message);
      setJoinCode('');
      fetchMyClassrooms();
      if (onJoined) onJoined();
    } catch (e) {
      setError(e.message || 'Failed to join classroom.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Join via code */}
      <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold">Join a Classroom</h3>
            <p className="text-purple-300 text-xs">Enter the join code shared by your teacher</p>
          </div>
        </div>
        <form onSubmit={handleJoin} className="flex space-x-3">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Enter code (e.g. A1B2C3D4)"
            maxLength={8}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 font-mono tracking-widest uppercase focus:outline-none focus:border-purple-400 transition"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold px-6 py-3 rounded-xl shadow-lg disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Join'}
          </motion.button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-red-400 text-sm"
            >
              {error}
            </motion.p>
          )}
          {successMsg && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 text-green-400 text-sm flex items-center space-x-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMsg}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* My Classrooms */}
      <div>
        <h3 className="text-white font-semibold mb-3 flex items-center space-x-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span>My Classrooms</span>
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"
            />
          </div>
        ) : classrooms.length === 0 ? (
          <div className="text-center py-8 text-purple-300">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-sm">You haven't joined any classrooms yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classrooms.map((c, i) => (
              <motion.div
                key={c._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{c.name}</p>
                  <p className="text-purple-400 text-xs truncate">By {c.adminId?.email || 'Admin'}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinClassroom;
