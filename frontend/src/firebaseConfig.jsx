import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCkHx780NzxG4mqYkJfovdJpPeMQi9fmBg",
  authDomain: "vivaq-416.firebaseapp.com",
  projectId: "vivaq-416",
  storageBucket: "vivaq-416.firebasestorage.app",
  messagingSenderId: "342270985251",
  appId: "1:342270985251:web:49b6e31ab805d77e0edd96",
  measurementId: "G-DBRQ4SLEBZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };
