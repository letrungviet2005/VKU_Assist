import { INITIAL_DOCUMENTS } from './mockData';

const STORAGE_KEYS = {
  THEME: 'vku_assist_theme',
  THEME_MODE: 'vku_assist_theme_mode',
  REDUCED_GLASS: 'vku_assist_reduced_glass',
  FONT_SIZE: 'vku_assist_font_size',
  MOCK_MODE: 'vku_assist_mock_mode',
  SESSION_ID: 'vku_assist_session_id',
  SESSION_TOKEN: 'vku_assist_session_token',
  CHAT_SESSIONS: 'vku_assist_chat_sessions',
  PINNED_SESSIONS: 'vku_assist_pinned_sessions',
  ADMIN_TOKEN: 'vku_assist_admin_token',
  DOCUMENTS: 'vku_assist_documents',
  JOBS: 'vku_assist_jobs',
  FEEDBACK: 'vku_assist_feedback',
  SAVED_ITEMS: 'vku_assist_saved_items',
  GRADUATION_CHECKLIST: 'vku_assist_grad_checklist',
  GPA_COURSES: 'vku_assist_gpa_courses',
};

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const storage = {
  // Theme & Visual Preferences
  getTheme: () => localStorage.getItem(STORAGE_KEYS.THEME) || 'light',
  setTheme: (theme) => localStorage.setItem(STORAGE_KEYS.THEME, theme),

  getPreferences: () => ({
    themeMode: localStorage.getItem(STORAGE_KEYS.THEME_MODE) || localStorage.getItem(STORAGE_KEYS.THEME) || 'light',
    reducedGlass: localStorage.getItem(STORAGE_KEYS.REDUCED_GLASS) === 'true',
    fontSize: localStorage.getItem(STORAGE_KEYS.FONT_SIZE) || 'md',
  }),
  savePreferences: ({ themeMode, reducedGlass, fontSize }) => {
    if (themeMode !== undefined) localStorage.setItem(STORAGE_KEYS.THEME_MODE, themeMode);
    if (reducedGlass !== undefined) localStorage.setItem(STORAGE_KEYS.REDUCED_GLASS, String(reducedGlass));
    if (fontSize !== undefined) localStorage.setItem(STORAGE_KEYS.FONT_SIZE, fontSize);
  },

  // Mock Mode
  getMockMode: () => {
    const val = localStorage.getItem(STORAGE_KEYS.MOCK_MODE);
    return val !== null ? val === 'true' : true;
  },
  setMockMode: (isMock) => localStorage.setItem(STORAGE_KEYS.MOCK_MODE, String(isMock)),

  // Session Identity
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

  // Chat History & Pinned Sessions
  getChatSessions: () => safeReadJson(STORAGE_KEYS.CHAT_SESSIONS, []),
  saveChatSessions: (sessions) => localStorage.setItem(STORAGE_KEYS.CHAT_SESSIONS, JSON.stringify(sessions)),

  getPinnedSessionIds: () => safeReadJson(STORAGE_KEYS.PINNED_SESSIONS, []),
  togglePinSession: (sessionId) => {
    const current = storage.getPinnedSessionIds();
    const next = current.includes(sessionId)
      ? current.filter((id) => id !== sessionId)
      : [sessionId, ...current];
    localStorage.setItem(STORAGE_KEYS.PINNED_SESSIONS, JSON.stringify(next));
    return next;
  },

  // Admin Token
  getAdminToken: () => localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN),
  setAdminToken: (token) => {
    if (token) localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);
    else localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  },

  // Admin Documents (also upgrades legacy 404 placeholder URLs cached in localStorage)
  getDocuments: () => {
    const cached = safeReadJson(STORAGE_KEYS.DOCUMENTS, null);
    if (!cached) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(INITIAL_DOCUMENTS));
      return INITIAL_DOCUMENTS;
    }
    const LEGACY_URL_MAP = {
      'https://vku.udn.vn/tuyen-sinh/de-an-tuyen-sinh-2026': 'https://tuyensinh.vku.udn.vn/',
      'https://vku.udn.vn/dao-tao/quy-che-tin-chi': 'https://daotao.vku.udn.vn/',
      'https://vku.udn.vn/hoc-bong-tai-tro-2026': 'https://tuyensinh.vku.udn.vn/',
      'https://vku.udn.vn/chuan-dau-ra-tot-nghiep': 'https://daotao.vku.udn.vn/',
      'https://vku.udn.vn/thong-bao-hoc-phi-2026': 'https://vku.udn.vn/',
      'https://vku.udn.vn/hoc-phi-2026': 'https://vku.udn.vn/',
    };
    let changed = false;
    const migrated = cached.map((doc) => {
      if (doc.source_url && LEGACY_URL_MAP[doc.source_url]) {
        changed = true;
        return { ...doc, source_url: LEGACY_URL_MAP[doc.source_url] };
      }
      return doc;
    });
    const existingIds = new Set(migrated.map((d) => d.document_id));
    const additions = INITIAL_DOCUMENTS.filter((d) => !existingIds.has(d.document_id));
    if (additions.length > 0) changed = true;
    const finalDocs = [...additions, ...migrated];
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(finalDocs));
    }
    return finalDocs;
  },
  saveDocuments: (docs) => localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs)),

  // Jobs
  getJobs: () => safeReadJson(STORAGE_KEYS.JOBS, []),
  saveJobs: (jobs) => localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs)),

  // Feedback
  getFeedback: () => safeReadJson(STORAGE_KEYS.FEEDBACK, []),
  saveFeedback: (item) => {
    const list = storage.getFeedback();
    list.unshift({ ...item, created_at: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(list.slice(0, 50)));
  },

  // Saved / Bookmarked Answers & Citations
  getSavedItems: () => safeReadJson(STORAGE_KEYS.SAVED_ITEMS, []),
  saveSavedItems: (items) => localStorage.setItem(STORAGE_KEYS.SAVED_ITEMS, JSON.stringify(items)),
  addSavedItem: (item) => {
    const items = storage.getSavedItems();
    const deduped = items.filter((existing) => existing.id !== item.id);
    const updated = [{ ...item, savedAt: new Date().toISOString() }, ...deduped];
    storage.saveSavedItems(updated);
    return updated;
  },

  // Tools Persistence (GPA & Graduation Checklist)
  getGpaCourses: () => safeReadJson(STORAGE_KEYS.GPA_COURSES, null),
  saveGpaCourses: (courses) => localStorage.setItem(STORAGE_KEYS.GPA_COURSES, JSON.stringify(courses)),

  getGraduationChecklist: () => safeReadJson(STORAGE_KEYS.GRADUATION_CHECKLIST, null),
  saveGraduationChecklist: (state) => localStorage.setItem(STORAGE_KEYS.GRADUATION_CHECKLIST, JSON.stringify(state)),
};
