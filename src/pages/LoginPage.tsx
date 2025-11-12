import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const GoogleIcon = () => (
  <svg className="w-6 h-6 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.8 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v8.51h12.8c-.57 3.03-2.31 5.45-4.96 7.17l7.98 6.19C43.02 36.42 46.98 31.05 46.98 24.55z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.11 1.45-4.79 2.3-7.91 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (error) {
      console.error("Error logging in with Google:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl font-semibold text-gray-700 animate-pulse">Loading...</div>
      </div>
    );
  }
  
  if (user) {
      return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 sm:p-12 text-center">
        
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-4">
          Welcome to <span className="text-blue-600">To-do List - Just Say Easy</span>
        </h1>
        <p className="text-gray-600 mb-10 text-lg">
          Manage your daily tasks efficiently.
        </p>

        <button 
          onClick={handleGoogleLogin}
          className="w-full inline-flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg shadow-sm px-6 py-3 text-lg font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 transition-all duration-200"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;