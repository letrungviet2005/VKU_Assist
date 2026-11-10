/**
 * VKU ASSIST - API INTEGRATION CLIENT & CONTRACT ADAPTER
 * Hỗ trợ:
 * - Multi-page Library & Semantic Search (/api/library/*)
 * - SSE Streaming & Multi-turn Chat (/api/chat/stream, fallback /api/chat)
 * - Session Management (/api/sessions/*)
 * - Feedback (/api/feedback)
 * - Admin Auth, Document Upload (FormData), Delete & Job Polling (/api/admin/*)
 */

import { storage } from './storage';
import {
  INITIAL_DOCUMENTS,
  MOCK_DOCUMENT_CHUNKS,
  MOCK_QA_DATABASE,
  MOCK_CLARIFICATION_ANSWER,
  MOCK_INSUFFICIENT_EVIDENCE,
} from './mockData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function createAbortError() {
  const err = new Error('Yêu cầu đã bị hủy bởi người dùng.');
  err.name = 'AbortError';
  return err;
}

export const api = {
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Health check returned ${res.status}`);
      return await res.json();
    } catch (err) {
      return { status: 'offline', error: err.message };
    }
  },

  async checkReady() {
    try {
      const res = await fetch(`${API_BASE}/ready`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, ...data };
    } catch (err) {
      return { ok: false, status: 0, reason: 'unreachable', error: err.message };
    }
  },

  async sendChat({ message, category = null, applicable_year = null, isMock = false, signal = null }) {
    if (isMock) {
      return this._mockChatResponse({ message, category, applicable_year, signal });
    }

    const requestId = generateUUID();
    const payload = { message: message.trim() };
    if (category) payload.category = category;
    if (applicable_year) payload.applicable_year = parseInt(applicable_year, 10);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(payload),
        signal,
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || data?.detail || `Yêu cầu thất bại với mã ${res.status}`;
        const errCode = data?.error?.code || `http_${res.status}`;
        const err = new Error(errMsg);
        err.code = errCode;
        err.status = res.status;
        err.requestId = data?.error?.request_id || requestId;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        const mockResult = await this._mockChatResponse({ message, category, applicable_year, signal });
        mockResult._isFallback = true;
        return mockResult;
      }
      throw err;
    }
  },

  /**
   * Stream chat response via SSE (/api/chat/stream) with fallback to /api/chat and Mock streaming
   */
  async sendChatStream({
    message,
    category = null,
    applicable_year = null,
    document_id = null,
    session_id = null,
    history = [],
    isMock = false,
    signal = null,
    onMeta = null,
    onToken = null,
  }) {
    if (isMock) {
      return this._mockStreamResponse({ message, category, applicable_year, document_id, history, signal, onMeta, onToken });
    }

    const requestId = generateUUID();
    const payload = {
      message: message.trim(),
      history: history.slice(-6).map((h) => ({ role: h.role, content: String(h.content || '').slice(0, 3500) })),
    };
    if (category) payload.category = category;
    if (applicable_year) payload.applicable_year = parseInt(applicable_year, 10);
    if (document_id) payload.document_id = document_id;
    if (session_id) payload.session_id = session_id;

    try {
      const res = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (res.status === 404) {
        // Fallback cleanly to legacy /api/chat
        const legacy = await this.sendChat({ message, category, applicable_year, isMock: false, signal });
        onMeta?.(legacy);
        onToken?.(legacy.answer);
        return legacy;
      }

      if (!res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch {
          // ignore
        }
        const err = new Error(data?.error?.message || data?.detail || `Yêu cầu thất bại với mã ${res.status}`);
        err.code = data?.error?.code || `http_${res.status}`;
        err.status = res.status;
        err.requestId = data?.error?.request_id || requestId;
        throw err;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        const legacy = await this.sendChat({ message, category, applicable_year, isMock: false, signal });
        onMeta?.(legacy);
        onToken?.(legacy.answer);
        return legacy;
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let meta = {};
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          if (!frame.trim()) continue;
          let eventName = 'message';
          let dataLine = '';
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          const parsed = JSON.parse(dataLine);
          if (eventName === 'meta') {
            meta = parsed;
            onMeta?.(meta);
          } else if (eventName === 'token') {
            const delta = parsed.delta || '';
            accumulated += delta;
            onToken?.(accumulated, delta);
          } else if (eventName === 'error') {
            const err = new Error(parsed.message || 'Lỗi xử lý luồng hỏi đáp.');
            err.code = parsed.code || 'stream_error';
            err.requestId = parsed.request_id || requestId;
            throw err;
          }
        }
      }

      return {
        ...meta,
        answer: accumulated,
      };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        const mockResult = await this._mockStreamResponse({
          message,
          category,
          applicable_year,
          document_id,
          history,
          signal,
          onMeta,
          onToken,
        });
        mockResult._isFallback = true;
        return mockResult;
      }
      throw err;
    }
  },

  async _mockStreamResponse({ message, category, applicable_year, document_id, history, signal, onMeta, onToken }) {
    const result = await this._mockChatResponse({ message, category, applicable_year, document_id, history, signal });
    onMeta?.(result);

    const text = result.answer || '';
    const sliceSize = 24;
    let current = '';
    for (let i = 0; i < text.length; i += sliceSize) {
      if (signal?.aborted) throw createAbortError();
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 18);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(createAbortError());
        }, { once: true });
      });
      const delta = text.slice(i, i + sliceSize);
      current += delta;
      onToken?.(current, delta);
    }
    return result;
  },

  async _mockChatResponse({ message, category = null, applicable_year = null, document_id = null, history = [], signal = null }) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 420);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(createAbortError());
        }, { once: true });
      }
    });

    // Multi-turn awareness in mock mode
    const lastUserPrev = [...(history || [])].reverse().find((h) => h.role === 'user')?.content || '';
    const rawNormalized = message.toLowerCase();
    const combinedForMatch = rawNormalized.length < 36 && lastUserPrev
      ? `${lastUserPrev.toLowerCase()} ${rawNormalized}`
      : rawNormalized;

    const requestId = generateUUID();
    const messageId = generateUUID();

    if (rawNormalized.length < 6 || rawNormalized === 'tuyển sinh' || rawNormalized === 'học vụ' || rawNormalized === 'điều kiện') {
      return {
        message_id: messageId,
        request_id: requestId,
        ...MOCK_CLARIFICATION_ANSWER,
        index_version: 'mock-index-v2026.1',
        generation_mode: 'fake',
      };
    }

    let match = null;
    for (const item of MOCK_QA_DATABASE) {
      const matchesDoc = !document_id || item.sources.some((s) => s.document_id === document_id);
      const matchesCat = !category || item.sources.some((s) => s.category === category);
      const matchesYear = !applicable_year || item.sources.some((s) => s.applicable_year === Number(applicable_year));
      if (matchesDoc && matchesCat && matchesYear && item.keywords.some((kw) => combinedForMatch.includes(kw))) {
        match = item;
        break;
      }
    }

    if (match) {
      return {
        message_id: messageId,
        request_id: requestId,
        status: match.status,
        answer: match.answer,
        sources: match.sources,
        followups: match.followups || [],
        index_version: 'mock-index-v2026.1',
        generation_mode: 'fake',
      };
    }

    return {
      message_id: messageId,
      request_id: requestId,
      ...MOCK_INSUFFICIENT_EVIDENCE,
      index_version: 'mock-index-v2026.1',
      generation_mode: 'fake',
    };
  },

  // --- Public Library & Semantic Search ---
  async getLibraryDocuments({ category = null, applicable_year = null, search = '', isMock = false } = {}) {
    if (!isMock) {
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (applicable_year) params.set('applicable_year', String(applicable_year));
        if (search) params.set('search', search);
        const queryStr = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`${API_BASE}/api/library/documents${queryStr}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) return await res.json();
      } catch {
        // Fall through to mock documents
      }
    }

    let docs = storage.getDocuments() || INITIAL_DOCUMENTS;
    docs = docs.filter((d) => d.status === 'ready');
    if (category) docs = docs.filter((d) => d.category === category);
    if (applicable_year) docs = docs.filter((d) => d.applicable_year === Number(applicable_year));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q) || (d.summary || '').toLowerCase().includes(q));
    }
    return { index_version: 'mock-index-v2026.1', total: docs.length, documents: docs };
  },

  async getLibraryDocumentDetail(documentId, isMock = false) {
    if (!isMock) {
      try {
        const res = await fetch(`${API_BASE}/api/library/documents/${documentId}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) return await res.json();
      } catch {
        // Fallback
      }
    }
    const docs = storage.getDocuments() || INITIAL_DOCUMENTS;
    const doc = docs.find((d) => d.document_id === documentId) || INITIAL_DOCUMENTS[0];
    const chunks = MOCK_DOCUMENT_CHUNKS.filter((c) => c.document_id === documentId);
    return { document: doc, chunks };
  },

  async searchLibrary({ query, top_k = 6, category = null, applicable_year = null, document_id = null, isMock = false }) {
    if (!isMock) {
      try {
        const payload = { query: query.trim(), top_k };
        if (category) payload.category = category;
        if (applicable_year) payload.applicable_year = parseInt(applicable_year, 10);
        if (document_id) payload.document_id = document_id;

        const res = await fetch(`${API_BASE}/api/library/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) return await res.json();
      } catch {
        // Fallback
      }
    }

    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    const filtered = MOCK_DOCUMENT_CHUNKS.filter((c) => {
      if (category && c.category !== category) return false;
      if (applicable_year && c.applicable_year !== Number(applicable_year)) return false;
      if (document_id && c.document_id !== document_id) return false;
      const hay = `${c.title} ${c.page_or_section} ${c.text}`.toLowerCase();
      return terms.length === 0 || terms.some((t) => hay.includes(t));
    });
    return {
      query,
      index_version: 'mock-index-v2026.1',
      results: filtered.slice(0, top_k),
    };
  },

  // --- Feedback ---
  async sendFeedback({ messageId, rating, comment = '' }) {
    storage.saveFeedback({ message_id: messageId, rating, comment });
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, rating, comment }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Saved locally
    }
    return { status: 'recorded', message_id: messageId };
  },

  async getFeedback() {
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch {
      // Fallback
    }
    return storage.getFeedback();
  },

  // --- Sessions ---
  async getSessions(isMock = false) {
    if (isMock) return storage.getChatSessions();
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        return data.sessions || [];
      }
    } catch {
      // Fallback
    }
    return storage.getChatSessions();
  },

  async createSession({ id, title } = {}, isMock = false) {
    const newSession = {
      id: id || 'session_' + Date.now(),
      title: title || 'Cuộc trò chuyện mới',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (isMock) {
      const cur = storage.getChatSessions();
      storage.saveChatSessions([newSession, ...cur]);
      return newSession;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newSession.id, title: newSession.title }),
      });
      if (res.ok) {
        const created = await res.json();
        const cur = storage.getChatSessions();
        storage.saveChatSessions([created, ...cur]);
        return created;
      }
    } catch {
      // Fallback
    }
    const cur = storage.getChatSessions();
    storage.saveChatSessions([newSession, ...cur]);
    return newSession;
  },

  async updateSessionTitle(sessionId, title, isMock = false) {
    const cur = storage.getChatSessions();
    const updated = cur.map((s) => (s.id === sessionId ? { ...s, title, updatedAt: new Date().toISOString() } : s));
    storage.saveChatSessions(updated);
    if (!isMock) {
      try {
        await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
      } catch {
        // ignore
      }
    }
    return { id: sessionId, title };
  },

  async deleteSession(sessionId, isMock = false) {
    const cur = storage.getChatSessions();
    storage.saveChatSessions(cur.filter((s) => s.id !== sessionId));
    if (!isMock) {
      try {
        await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
    return { status: 'deleted', id: sessionId };
  },

  async clearSessions(isMock = false) {
    storage.saveChatSessions([]);
    if (!isMock) {
      try {
        await fetch(`${API_BASE}/api/sessions`, { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
    return { status: 'cleared' };
  },

  async getSessionMessages(sessionId, isMock = false) {
    if (isMock) {
      const target = storage.getChatSessions().find((s) => s.id === sessionId);
      return target?.messages || [];
    }
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, { headers: { Accept: 'application/json' } });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
    const target = storage.getChatSessions().find((s) => s.id === sessionId);
    return target?.messages || [];
  },

  async addMessage(sessionId, message, isMock = false) {
    if (!isMock) {
      try {
        await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
      } catch {
        // ignore
      }
    }
  },

  // --- Admin Auth, Documents & Live Jobs ---
  async adminLogin(username, password, isMock = false) {
    if (!isMock) {
      try {
        const res = await fetch(`${API_BASE}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (res.ok && data.access_token) {
          storage.setAdminToken(data.access_token);
          return data;
        }
        if (res.status === 401 || res.status === 422) {
          throw new Error(data?.error?.message || 'Tài khoản hoặc mật khẩu quản trị không chính xác.');
        }
      } catch (err) {
        if (!err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
          throw err;
        }
      }
    }

    if (username === 'admin' && (password === 'vku2026' || password === 'admin' || password === 'admin123')) {
      const token = 'admin_jwt_' + Math.random().toString(36).substring(2);
      storage.setAdminToken(token);
      return { access_token: token, token_type: 'bearer', expires_at: Date.now() + 86400000 };
    }
    throw new Error('Tài khoản hoặc mật khẩu quản trị không chính xác.');
  },

  async getDocuments(isMock = false) {
    if (!isMock) {
      try {
        const token = storage.getAdminToken();
        const res = await fetch(`${API_BASE}/api/admin/documents`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) return await res.json();
      } catch {
        // Fallback
      }
    }
    return storage.getDocuments();
  },

  async uploadDocument({ title, category, source_url, applicable_year, issue_date, file }, isMock = false) {
    if (!isMock) {
      try {
        const token = storage.getAdminToken();
        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category || 'academic');
        if (source_url) formData.append('source_url', source_url);
        if (applicable_year) formData.append('applicable_year', String(applicable_year));
        if (issue_date) formData.append('issue_date', issue_date);
        if (file) formData.append('file', file);

        const res = await fetch(`${API_BASE}/api/admin/documents`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) return await res.json();
        const errData = await res.json().catch(() => null);
        if (res.status >= 400 && res.status < 500) {
          throw new Error(errData?.error?.message || 'Tải lên tài liệu thất bại.');
        }
      } catch (err) {
        if (!err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
          throw err;
        }
      }
    }

    const docId = 'doc_' + Math.random().toString(36).substring(2, 9);
    const jobId = 'job_' + Math.random().toString(36).substring(2, 9);
    const newDoc = {
      document_id: docId,
      title,
      category,
      source_url: source_url || (category === 'admissions' ? 'https://tuyensinh.vku.udn.vn/' : 'https://daotao.vku.udn.vn/'),
      applicable_year: applicable_year ? parseInt(applicable_year, 10) : null,
      issue_date: issue_date || new Date().toISOString().split('T')[0],
      version: 'v1.0',
      status: 'processing',
      chunks_count: 0,
      size_mb: file ? Number((file.size / (1024 * 1024)).toFixed(2)) : 1.5,
      updated_at: new Date().toISOString(),
    };
    storage.saveDocuments([newDoc, ...storage.getDocuments()]);

    const newJob = {
      job_id: jobId,
      document_id: docId,
      status: 'processing',
      progress: 30,
      title,
      created_at: new Date().toISOString(),
    };
    storage.saveJobs([newJob, ...storage.getJobs()]);

    setTimeout(() => {
      const jobs = storage.getJobs().map((j) =>
        j.job_id === jobId ? { ...j, status: 'completed', progress: 100, index_version: 'index-' + Date.now().toString(36) } : j
      );
      storage.saveJobs(jobs);
      const docs = storage.getDocuments().map((d) =>
        d.document_id === docId ? { ...d, status: 'ready', chunks_count: Math.floor(Math.random() * 80 + 30) } : d
      );
      storage.saveDocuments(docs);
    }, 3500);

    return { document_id: docId, job_id: jobId, status: 'accepted' };
  },

  async deleteDocument(documentId, isMock = false) {
    if (!isMock) {
      try {
        const token = storage.getAdminToken();
        const res = await fetch(`${API_BASE}/api/admin/documents/${documentId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) return await res.json();
      } catch {
        // Fallback
      }
    }
    const docs = storage.getDocuments().filter((d) => d.document_id !== documentId);
    storage.saveDocuments(docs);
    return { status: 'deleted', document_id: documentId };
  },

  async getJobs(isMock = false) {
    if (!isMock) {
      try {
        const token = storage.getAdminToken();
        if (token) {
          const res = await fetch(`${API_BASE}/api/admin/jobs`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) return await res.json();
        }
      } catch {
        // Fallback
      }
    }
    return storage.getJobs();
  },
};
