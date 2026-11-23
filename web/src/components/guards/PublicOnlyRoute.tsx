import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const PublicOnlyRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading authentication status...</div>;
  }

  if (user) {
    if (user.role === 'STUDENT') {
      return <Navigate to="/student" replace />;
    }
    if (user.role === 'WARDEN') {
      return <Navigate to="/warden" replace />;
    }
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
