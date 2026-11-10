import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { SpotlightModal } from './components/SpotlightModal';
import { PreferencesModal } from './components/PreferencesModal';
import { storage } from './services/storage';
import './App.css';

// Lazy-loaded pages for optimal Apple-fast bundle splitting
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const ToolsPage = lazy(() => import('./pages/ToolsPage').then((m) => ({ default: m.ToolsPage })));
const SavedPage = lazy(() => import('./pages/SavedPage').then((m) => ({ default: m.SavedPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function resolveSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function PageFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '16px 24px', borderRadius: 999 }}>
        <span className="text-muted">Đang tải không gian làm việc...</span>
      </div>
    </div>
  );
}

function App() {
  const [preferences, setPreferences] = useState(() => storage.getPreferences());
  const [isMockMode, setIsMockMode] = useState(() => storage.getMockMode());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [adminToken, setAdminToken] = useState(() => storage.getAdminToken());
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const effectiveTheme = preferences.themeMode === 'system'
    ? resolveSystemTheme()
    : preferences.themeMode;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-glass', preferences.reducedGlass ? 'solid' : 'liquid');
    document.documentElement.setAttribute('data-font-size', preferences.fontSize || 'md');
    storage.setTheme(effectiveTheme);
    storage.savePreferences(preferences);
  }, [effectiveTheme, preferences]);

  useEffect(() => {
    storage.setMockMode(isMockMode);
  }, [isMockMode]);

  // Global Cmd/Ctrl + K shortcut for Spotlight
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleToggleTheme = useCallback(() => {
    setPreferences((prev) => {
      const curr = prev.themeMode === 'system' ? resolveSystemTheme() : prev.themeMode;
      return { ...prev, themeMode: curr === 'dark' ? 'light' : 'dark' };
    });
  }, []);

  const handleUpdatePreferences = useCallback((patch) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleLogout = () => {
    storage.setAdminToken(null);
    setAdminToken(null);
  };

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar
          theme={effectiveTheme}
          onToggleTheme={handleToggleTheme}
          isMockMode={isMockMode}
          setIsMockMode={setIsMockMode}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          adminToken={adminToken}
          onLogout={handleLogout}
          onOpenSpotlight={() => setIsSpotlightOpen(true)}
          onOpenPreferences={() => setIsPreferencesOpen(true)}
        />

        <div className="app-content-body">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route
                path="/"
                element={<HomePage isMockMode={isMockMode} setIsMockMode={setIsMockMode} />}
              />
              <Route
                path="/chat"
                element={
                  <ChatPage
                    isMockMode={isMockMode}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                }
              />
              <Route
                path="/chat/:sessionId"
                element={
                  <ChatPage
                    isMockMode={isMockMode}
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                }
              />
              <Route
                path="/library"
                element={<LibraryPage isMockMode={isMockMode} />}
              />
              <Route
                path="/tools"
                element={<ToolsPage />}
              />
              <Route
                path="/saved"
                element={<SavedPage />}
              />
              <Route
                path="/admin"
                element={
                  <AdminPage
                    token={adminToken}
                    setToken={setAdminToken}
                    isMockMode={isMockMode}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>

        <SpotlightModal
          isOpen={isSpotlightOpen}
          onClose={() => setIsSpotlightOpen(false)}
          theme={effectiveTheme}
          onToggleTheme={handleToggleTheme}
          isMockMode={isMockMode}
          setIsMockMode={setIsMockMode}
        />

        <PreferencesModal
          isOpen={isPreferencesOpen}
          onClose={() => setIsPreferencesOpen(false)}
          preferences={preferences}
          onUpdatePreferences={handleUpdatePreferences}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
