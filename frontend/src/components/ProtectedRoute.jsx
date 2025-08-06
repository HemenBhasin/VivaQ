import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth} from '../firebaseConfig';
import { createPortal } from 'react-dom';
import LightRays from './LightRays';

function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [userRole, setUserRole] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        // TODO: Fetch user role from backend or Firebase custom claims
        // For demo, assume user with email ending with 'admin.com' or specific admin email is admin
        if (user.email.toLowerCase() === 'hemenbhasin@gmail.com' || user.email.endsWith('admin.com')) {
          setUserRole('admin');
        } else {
          setUserRole('student');
        }
      } else {
        setIsAuthenticated(false);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    // Add/remove class to body based on route
    if (location.pathname === '/admin' && userRole === 'admin') {
      document.body.classList.add('admin-page');
    } else {
      document.body.classList.remove('admin-page');
    }

    // Cleanup function to remove class when component unmounts
    return () => {
      document.body.classList.remove('admin-page');
    };
  }, [location.pathname, userRole]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/login" replace />;
  }

  // Render LightRays background for admin page
  if (location.pathname === '/admin' && userRole === 'admin') {
    return (
      <>
        {createPortal(
          <div style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0, zIndex: -1 }}>
            <LightRays
              raysOrigin="top-center"
              raysColor="#00ffff"
              raysSpeed={1.5}
              lightSpread={0.8}
              rayLength={1.2}
              followMouse={true}
              mouseInfluence={0.1}
              noiseAmount={0.1}
              distortion={0.05}
            />
          </div>,
          document.body
        )}
        {children}
      </>
    );
  }

  return children;
}

export default ProtectedRoute;
