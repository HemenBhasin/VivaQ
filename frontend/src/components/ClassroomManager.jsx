import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../firebaseConfig';
import { API_BASE } from '../apiConfig';

const ClassroomManager = () => {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE}/api/classrooms/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setClassrooms(data.classrooms || []);
    } catch (e) {
      setError('Failed to load classrooms.');
    } finally {
      setLoading(false);
    }
  };

  const createClassroom = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE}/api/classrooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName, description: newDesc })
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setNewName('');
      setNewDesc('');
      setShowCreateForm(false);
      fetchClassrooms();
    } catch (e) {
      setError(e.message || 'Failed to create classroom.');
    } finally {
      setCreating(false);
    }
  };

  const deleteClassroom = async (id) => {
    if (!window.confirm('Delete this classroom? Students will lose access.')) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      await fetch(`${API_BASE}/api/classrooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchClassrooms();
    } catch (e) {
      setError('Failed to delete classroom.');
    }
  };

  const copyJoinLink = (code) => {
    const link = `${window.location.origin}?join=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Classrooms</h2>
          <p className="text-purple-300 text-sm mt-1">Create groups and share private invite links</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-500/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Classroom</span>
        </motion.button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl">
          {error}
        </div>
      )}

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.form
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            onSubmit={createClassroom}
            className="mb-6 bg-white/5 border border-white/20 rounded-2xl p-6 overflow-hidden"
          >
            <h3 className="text-white font-semibold mb-4">Create New Classroom</h3>
            <div className="space-y-4">
              <div>
                <label className="text-purple-300 text-sm mb-1 block">Classroom Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Physics - Batch 2025"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
                  required
                />
              </div>
              <div>
                <label className="text-purple-300 text-sm mb-1 block">Description (optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="e.g. Weekly quiz group for Chapter 3"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-2.5 rounded-xl"
                >
                  {creating ? 'Creating...' : 'Create Classroom'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-5 py-2.5 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Classroom List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full"
          />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-16 text-purple-300">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-white">No classrooms yet</p>
          <p className="text-sm mt-1">Create your first classroom to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classrooms.map((classroom, i) => (
            <motion.div
              key={classroom._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 border border-white/15 rounded-2xl p-5 hover:border-purple-500/40 transition-all duration-300"
            >
              {/* Classroom Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{classroom.name}</h3>
                    {classroom.description && (
                      <p className="text-purple-300 text-xs mt-0.5 truncate max-w-[180px]">{classroom.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteClassroom(classroom._id)}
                  className="text-white/30 hover:text-red-400 transition-colors p-1"
                  title="Delete classroom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-4 mb-4 text-sm text-purple-300">
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>{classroom.students?.length || 0} student{classroom.students?.length !== 1 ? 's' : ''}</span>
                </span>
              </div>

              {/* Join Code + Actions */}
              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-400 mb-0.5">Join Code</p>
                  <p className="text-white font-mono font-bold tracking-widest">{classroom.joinCode}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyJoinLink(classroom.joinCode)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    copiedCode === classroom.joinCode
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30'
                  }`}
                >
                  {copiedCode === classroom.joinCode ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy Link</span>
                    </>
                  )}
                </motion.button>
              </div>

              {/* Students list */}
              {classroom.students?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-purple-400 mb-2">Members</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                    {classroom.students.map((s, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                          {s.email?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-purple-300 text-xs truncate">{s.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassroomManager;
