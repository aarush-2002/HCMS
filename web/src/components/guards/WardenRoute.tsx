import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const WardenRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading authentication status...</div>;
  }

  if (!user) {
    return <Navigate to="/warden/login" replace />;
  }

  // Both WARDEN and ADMIN can access warden workspace
  if (user.role === 'STUDENT') {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};

export default WardenRoute;
