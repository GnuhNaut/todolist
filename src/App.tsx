// src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react'; // Import Suspense và lazy
import ProtectedRoute from './components/ProtectedRoute';

// Lazy load các trang
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage')); 

// Component Fallback khi đang tải code
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    // Bọc Routes bằng Suspense
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/group/:groupId"
          element={
            <ProtectedRoute>
              <GroupDetailPage />
            </ProtectedRoute>
          }
        /> 
      </Routes>
    </Suspense>
  );
}

export default App;