import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './themes/ThemeContext';
import { Layout } from './components/Layout';
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
import { useTheme } from './themes/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  
  return (
    <Layout key={theme.id}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/contexts" element={<ContextsPage />} />
        <Route path="/contexts/new" element={<ContextEditor />} />
        <Route path="/contexts/:id" element={<ContextEditor />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/programs/new" element={<ProgramEditor />} />
        <Route path="/programs/:id" element={<ProgramEditor />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/solution" element={<SolutionGenerator />} />
        <Route path="/sync" element={<PostmanSync />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/themes" element={<ThemeSettings />} />
      </Routes>
    </Layout>
  );
}

export default App;
