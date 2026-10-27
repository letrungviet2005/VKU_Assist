import { INITIAL_DOCUMENTS } from './mockData';

const STORAGE_KEYS = {
  THEME: 'vku_assist_theme',
  MOCK_MODE: 'vku_assist_mock_mode',
  SESSION_ID: 'vku_assist_session_id',
  SESSION_TOKEN: 'vku_assist_session_token',
  CHAT_SESSIONS: 'vku_assist_chat_sessions',
  ADMIN_TOKEN: 'vku_assist_admin_token',
  DOCUMENTS: 'vku_assist_documents',
  JOBS: 'vku_assist_jobs',
  FEEDBACK: 'vku_assist_feedback',
};

export const storage = {
  // Theme
  getTheme: () => localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
  setTheme: (theme) => localStorage.setItem(STORAGE_KEYS.THEME, theme),

  // Mock Mode (default true if backend is not yet started or user toggles)
  getMockMode: () => {
    const val = localStorage.getItem(STORAGE_KEYS.MOCK_MODE);
    return val !== null ? val === 'true' : true;
  },
  setMockMode: (isMock) => localStorage.setItem(STORAGE_KEYS.MOCK_MODE, String(isMock)),

  // Session
  getSession: () => {
    let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    let sessionToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 10);
      sessionToken = 'tok_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, sessionToken);
    }
    return { sessionId, sessionToken };
  },

  // Chat History
  getChatSessions: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHAT_SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveChatSessions: (sessions) => {
    localStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(sessions));
  },

  // Admin Token
  getAdminToken: () => localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN),
  setAdminToken: (token) => {
    if (token) localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  },

  // Admin Documents
  getDocuments: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
        return INITIAL_DOCUMENTS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_DOCUMENTS;
    }
  },
  saveDocuments: (docs) => {
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  },

  // Jobs
  getJobs: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.JOBS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveJobs: (jobs) => {
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
  },

  // Feedback
  getFeedback: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FEEDBACK);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveFeedback: (item) => {
    const list = storage.getFeedback();
    list.unshift({ ...item, created_at: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(list.slice(0, 50)));
  }
};
