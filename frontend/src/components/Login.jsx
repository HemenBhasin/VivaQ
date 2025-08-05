import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../../firebaseConfig';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';

function Login() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);
  const navigate = useNavigate();

  const redirectUser = (user) => {
    const email = user.email;
    console.log(`Redirecting user with email: "${email}" (length: ${email.length})`);
    // Here you would fetch user role from your backend or Firebase custom claims
    // For demo, assume user with email 'hemenbhasin@gmail.com' is admin
    if (email.trim().toLowerCase() === 'hemenbhasin@gmail.com') {
      console.log('Navigating to /admin');
      navigate('/admin');
    } else {
      console.log('Navigating to /student');
      navigate('/student');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      redirectUser(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    console.log('Google login started');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Google login successful:', result.user);
      if (result && result.user) {
        redirectUser(result.user);
      } else {
        console.error('No user found in Google login result');
      }
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded shadow">
      <h2 className="text-2xl mb-4">Login</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleEmailLogin} className="mb-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
          Login with Email
        </button>
      </form>
      <button
        onClick={handleGoogleLogin}
        className="w-full bg-red-600 text-white p-2 rounded"
      >
        Login with Google
      </button>
    </div>
  );
}

export default Login;
