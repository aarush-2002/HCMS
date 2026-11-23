import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const StudentRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading authentication status...</div>;
  }

  if (!user) {
    return <Navigate to="/student/login" replace />;
  }

  if (user.role !== 'STUDENT') {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};

export default StudentRoute;
