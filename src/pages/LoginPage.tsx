import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const loginPageStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  fontSize: '18px',
  cursor: 'pointer',
};

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
      console.error("Lỗi khi đăng nhập Google:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (user) {
      return null;
  }

  return (
    <div style={loginPageStyle}>
      <h1>Welcome to Your TodoList</h1>
      <button style={buttonStyle} onClick={handleGoogleLogin}>
        Sign in with Google
      </button>
    </div>
  );
};

export default LoginPage;