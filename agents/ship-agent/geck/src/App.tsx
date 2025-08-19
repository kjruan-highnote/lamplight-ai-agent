import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './themes/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ContextsPage } from './pages/ContextsPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ContextEditor } from './pages/ContextEditor';
import { ProgramEditor } from './pages/ProgramEditor';
import { OperationsPage } from './pages/OperationsPage';
import { SolutionGenerator } from './pages/SolutionGenerator';
import { PostmanSync } from './pages/PostmanSync';
import { Settings } from './pages/Settings';
import { ThemeSettings } from './pages/settings/ThemeSettings';
import { ApiSettings } from './pages/settings/ApiSettings';
import { useTheme } from './themes/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <Login />
      } />
      
      {/* Protected routes */}
      <Route element={
        <ProtectedRoute>
          <Layout key={theme.id}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              
              {/* Context routes */}
              <Route path="/contexts" element={
                <ProtectedRoute requiredPermission={{ resource: 'contexts', action: 'view' }}>
                  <ContextsPage />
                </ProtectedRoute>
              } />
              <Route path="/contexts/new" element={
                <ProtectedRoute requiredPermission={{ resource: 'contexts', action: 'create' }}>
                  <ContextEditor />
                </ProtectedRoute>
              } />
              <Route path="/contexts/:id" element={
                <ProtectedRoute requiredPermission={{ resource: 'contexts', action: 'edit' }}>
                  <ContextEditor />
                </ProtectedRoute>
              } />
              
              {/* Program routes */}
              <Route path="/programs" element={
                <ProtectedRoute requiredPermission={{ resource: 'programs', action: 'view' }}>
                  <ProgramsPage />
                </ProtectedRoute>
              } />
              <Route path="/programs/new" element={
                <ProtectedRoute requiredPermission={{ resource: 'programs', action: 'create' }}>
                  <ProgramEditor />
                </ProtectedRoute>
              } />
              <Route path="/programs/:id" element={
                <ProtectedRoute requiredPermission={{ resource: 'programs', action: 'edit' }}>
                  <ProgramEditor />
                </ProtectedRoute>
              } />
              
              {/* Operations routes */}
              <Route path="/operations" element={
                <ProtectedRoute requiredPermission={{ resource: 'operations', action: 'view' }}>
                  <OperationsPage />
                </ProtectedRoute>
              } />
              
              {/* System routes */}
              <Route path="/solution" element={
                <ProtectedRoute requiredPermission={{ resource: 'system', action: 'generateSolutions' }}>
                  <SolutionGenerator />
                </ProtectedRoute>
              } />
              <Route path="/sync" element={
                <ProtectedRoute requiredPermission={{ resource: 'system', action: 'syncPostman' }}>
                  <PostmanSync />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute requiredPermission={{ resource: 'system', action: 'configureSettings' }}>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/settings/themes" element={
                <ProtectedRoute requiredPermission={{ resource: 'system', action: 'configureSettings' }}>
                  <ThemeSettings />
                </ProtectedRoute>
              } />
              <Route path="/settings/api" element={
                <ProtectedRoute requiredPermission={{ resource: 'system', action: 'configureSettings' }}>
                  <ApiSettings />
                </ProtectedRoute>
              } />
            </Routes>
          </Layout>
        </ProtectedRoute>
      }>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
