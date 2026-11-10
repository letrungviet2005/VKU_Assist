import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Trash2,
  MessageSquare,
  AlertOctagon,
  RefreshCw,
  BookOpen,
  GraduationCap,
  Calendar,
  Award,
  BookCheck,
  FileSpreadsheet,
  Search,
  Edit2,
  Check,
  X,
  Download,
  ArrowDown,
  Pin,
} from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { FeedbackModal } from '../components/FeedbackModal';
import { CitationInspector } from '../components/CitationInspector';
import { api } from '../services/api';
import { storage } from '../services/storage';

function groupSessions(sessionsList, pinnedIds) {
  const now = Date.now();
  const oneDay = 86400000;
  const sevenDays = 7 * oneDay;

  const groups = {
    pinned: [],
    today: [],
    week: [],
    older: [],
  };

  sessionsList.forEach((s) => {
    if (pinnedIds.includes(s.id)) {
      groups.pinned.push(s);
      return;
    }
    const ts = new Date(s.updatedAt || s.updated_at || s.createdAt || s.created_at || now).getTime();
    const diff = now - ts;
    if (diff < oneDay) groups.today.push(s);
    else if (diff < sevenDays) groups.week.push(s);
    else groups.older.push(s);
  });

  return [
    { key: 'pinned', label: 'Đã ghim', items: groups.pinned },
    { key: 'today', label: 'Hôm nay', items: groups.today },
    { key: 'week', label: '7 ngày qua', items: groups.week },
    { key: 'older', label: 'Trước đó', items: groups.older },
  ].filter((g) => g.items.length > 0);
}

export function ChatPage({ isMockMode, isSidebarOpen, setIsSidebarOpen }) {
  const { sessionId: routeSessionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState(() => {
    const saved = storage.getChatSessions();
    if (saved && saved.length > 0) return saved;
    const initialSession = {
      id: 'session_' + Date.now(),
      title: 'Cuộc trò chuyện mới',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.saveChatSessions([initialSession]);
    return [initialSession];
  });

  const [currentSessionId, setCurrentSessionId] = useState(() => {
    if (routeSessionId) return routeSessionId;
    const saved = storage.getChatSessions();
    return saved && saved.length > 0 ? saved[0].id : null;
  });

  const [messages, setMessages] = useState(() => {
    const saved = storage.getChatSessions();
    const target = routeSessionId ? saved.find((s) => s.id === routeSessionId) : saved[0];
    return target?.messages || [];
  });

  const [pinnedIds, setPinnedIds] = useState(() => storage.getPinnedSessionIds());
  const [savedMsgIds, setSavedMsgIds] = useState(() =>
    new Set((storage.getSavedItems() || []).map((item) => item.id))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(null);
  const [applicableYear, setApplicableYear] = useState(null);
  const [scopedDocument, setScopedDocument] = useState(() => {
    const docId = searchParams.get('doc');
    const docTitle = searchParams.get('docTitle');
    return docId ? { document_id: docId, title: docTitle || docId } : null;
  });

  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [inspectedSource, setInspectedSource] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [sessionSearch, setSessionSearch] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const messagesScrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const initialQueryHandledRef = useRef(false);

  // Sync route sessionId
  useEffect(() => {
    if (routeSessionId && routeSessionId !== currentSessionId) {
      setCurrentSessionId(routeSessionId);
      api.getSessionMessages(routeSessionId, isMockMode).then((msgs) => {
        setMessages(msgs || []);
      });
    }
  }, [routeSessionId, currentSessionId, isMockMode]);

  // Load sessions on mount or mode change
  useEffect(() => {
    let isMounted = true;
    async function fetchSessions() {
      try {
        const loaded = await api.getSessions(isMockMode);
        if (isMounted && loaded && loaded.length > 0) {
          setSessions(loaded);
          const preferredId = routeSessionId && loaded.some((s) => s.id === routeSessionId)
            ? routeSessionId
            : currentSessionId && loaded.some((s) => s.id === currentSessionId)
              ? currentSessionId
              : loaded[0].id;
          setCurrentSessionId(preferredId);
          const msgs = await api.getSessionMessages(preferredId, isMockMode);
          if (isMounted) setMessages(msgs || []);
        }
      } catch (err) {
        console.error('Error fetching sessions:', err);
      }
    }
    fetchSessions();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMockMode]);

  const updateCurrentSessionMessages = useCallback((sessionIdTarget, newMessages) => {
    setMessages(newMessages);
    if (!sessionIdTarget) return;

    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === sessionIdTarget) {
          const firstUserMsg = newMessages.find((m) => m.role === 'user');
          const title = s.title !== 'Cuộc trò chuyện mới'
            ? s.title
            : firstUserMsg
              ? firstUserMsg.content.substring(0, 38)
              : 'Cuộc trò chuyện mới';
          return { ...s, title, messages: newMessages, updatedAt: new Date().toISOString() };
        }
        return s;
      });
      storage.saveChatSessions(updated);
      return updated;
    });
  }, []);

  const handleScroll = () => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 220);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading]);

  const startNewSession = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const newSession = await api.createSession({ title: 'Cuộc trò chuyện mới' }, isMockMode);
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setError(null);
    setInspectedSource(null);
    navigate(`/chat/${newSession.id}`);
    return newSession;
  };

  const switchSession = async (sessionId) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setCurrentSessionId(sessionId);
    setError(null);
    setInspectedSource(null);
    navigate(`/chat/${sessionId}`);
    const msgs = await api.getSessionMessages(sessionId, isMockMode);
    setMessages(msgs || []);
  };

  const handleTogglePin = (sessionId, e) => {
    e.stopPropagation();
    setPinnedIds(storage.togglePinSession(sessionId));
  };

  const handleStartRename = (session, e) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveRename = async (sessionId, e) => {
    e?.stopPropagation();
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    const updatedTitle = editingTitle.trim();
    await api.updateSessionTitle(sessionId, updatedTitle, isMockMode);
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: updatedTitle } : s)));
    setEditingSessionId(null);
  };

  const handleCancelRename = (e) => {
    e?.stopPropagation();
    setEditingSessionId(null);
  };

  const deleteSingleSession = async (sessionId, e) => {
    e.stopPropagation();
    await api.deleteSession(sessionId, isMockMode);
    const remaining = sessions.filter((s) => s.id !== sessionId);
    setSessions(remaining);

    if (currentSessionId === sessionId) {
      if (remaining.length > 0) {
        await switchSession(remaining[0].id);
      } else {
        await startNewSession();
      }
    }
  };

  const handleClearAllSessions = async () => {
    await api.clearSessions(isMockMode);
    setSessions([]);
    setShowClearConfirm(false);
    await startNewSession();
  };

  const handleToggleSaveMessage = (msg) => {
    const id = msg.message_id || msg.timestamp;
    if (!id) return;
    if (savedMsgIds.has(id)) {
      const next = storage.getSavedItems().filter((item) => item.id !== id);
      storage.saveSavedItems(next);
      setSavedMsgIds(new Set(next.map((i) => i.id)));
    } else {
      const next = storage.addSavedItem({
        id,
        title: msg.content?.slice(0, 60) || 'Câu trả lời VKU Assist',
        content: msg.content,
        sources: msg.sources || [],
        tag: category === 'admissions' ? 'Tuyển sinh' : 'Học vụ',
      });
      setSavedMsgIds(new Set(next.map((i) => i.id)));
    }
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    const currentSession = sessions.find((s) => s.id === currentSessionId);
    const sessionTitle = currentSession?.title || 'cuoc-tro-chuyen-vku';
    let exportContent = `# BIÊN BẢN TRA CỨU HỌC VỤ & TUYỂN SINH VKU ASSIST\n`;
    exportContent += `**Chủ đề:** ${sessionTitle}\n`;
    exportContent += `**Thời gian xuất:** ${new Date().toLocaleString('vi-VN')}\n\n---\n\n`;

    messages.forEach((m, idx) => {
      const roleName = m.role === 'user' ? 'Sinh viên' : 'Trợ lý VKU Assist';
      exportContent += `### ${idx + 1}. ${roleName}\n\n${m.content}\n\n`;
      if (m.sources?.length) {
        exportContent += `**Căn cứ văn bản:**\n`;
        m.sources.forEach((s) => {
          exportContent += `- [${s.source_id}] ${s.title} (${s.page_or_section || 'Văn bản'})\n`;
        });
        exportContent += `\n`;
      }
      exportContent += `---\n\n`;
    });

    const blob = new Blob([exportContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sessionTitle.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]/g, '_')}_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = useCallback(async (text, explicitSessionId = null, explicitHistory = null) => {
    if (!text.trim() || isLoading) return;

    const targetSessionId = explicitSessionId || currentSessionId;
    const baseMessages = explicitHistory || messages;

    setError(null);
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMsgsWithUser = [...baseMessages, userMsg];
    updateCurrentSessionMessages(targetSessionId, newMsgsWithUser);
    setIsLoading(true);

    if (targetSessionId) {
      api.addMessage(targetSessionId, userMsg, isMockMode);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let streamMeta = {};
    const streamingMsgId = 'stream_' + Date.now();

    try {
      const response = await api.sendChatStream({
        message: text,
        category,
        applicable_year: applicableYear,
        document_id: scopedDocument?.document_id || null,
        session_id: targetSessionId,
        history: baseMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        isMock: isMockMode,
        signal: controller.signal,
        onMeta: (meta) => {
          streamMeta = meta;
        },
        onToken: (accumulatedText) => {
          const partialBotMsg = {
            role: 'assistant',
            content: accumulatedText,
            status: streamMeta.status || 'answered',
            sources: streamMeta.sources || [],
            followups: streamMeta.followups || [],
            message_id: streamMeta.message_id || streamingMsgId,
            request_id: streamMeta.request_id,
            index_version: streamMeta.index_version,
            generation_mode: streamMeta.generation_mode,
            isStreaming: true,
            timestamp: new Date().toISOString(),
          };
          setMessages([...newMsgsWithUser, partialBotMsg]);
        },
      });

      const finalBotMsg = {
        role: 'assistant',
        content: response.answer,
        status: response.status,
        sources: response.sources || [],
        followups: response.followups || [],
        message_id: response.message_id || streamingMsgId,
        request_id: response.request_id,
        index_version: response.index_version,
        generation_mode: response.generation_mode,
        isStreaming: false,
        timestamp: new Date().toISOString(),
      };

      if (targetSessionId) {
        api.addMessage(targetSessionId, finalBotMsg, isMockMode);
      }
      updateCurrentSessionMessages(targetSessionId, [...newMsgsWithUser, finalBotMsg]);
    } catch (err) {
      if (err.name === 'AbortError') {
        const stoppedMsg = {
          role: 'assistant',
          content: '*(Phản hồi đã dừng theo yêu cầu của bạn)*',
          status: 'insufficient_evidence',
          timestamp: new Date().toISOString(),
        };
        updateCurrentSessionMessages(targetSessionId, [...newMsgsWithUser, stoppedMsg]);
      } else {
        setError({
          code: err.code || 'error',
          message: err.message || 'Không thể kết nối đến máy chủ hỏi đáp.',
          status: err.status,
          requestId: err.requestId,
          lastQuestion: text,
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, currentSessionId, messages, isMockMode, category, applicableYear, scopedDocument, updateCurrentSessionMessages]);

  // Handle ?q=... auto-send when coming from HomePage or ToolsPage
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam && !initialQueryHandledRef.current) {
      initialQueryHandledRef.current = true;
      searchParams.delete('q');
      setSearchParams(searchParams, { replace: true });

      api.createSession({ title: qParam.slice(0, 38) }, isMockMode).then((newSess) => {
        setSessions((prev) => [newSess, ...prev]);
        setCurrentSessionId(newSess.id);
        setMessages([]);
        handleSendMessage(qParam, newSess.id, []);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleAbortGeneration = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const handleRetry = () => {
    if (error?.lastQuestion) {
      const lastQ = error.lastQuestion;
      setError(null);
      handleSendMessage(lastQ);
    }
  };

  const filteredSessions = useMemo(
    () => sessions.filter((s) => (s.title || '').toLowerCase().includes(sessionSearch.toLowerCase())),
    [sessions, sessionSearch]
  );

  const groupedSessions = useMemo(
    () => groupSessions(filteredSessions, pinnedIds),
    [filteredSessions, pinnedIds]
  );

  return (
    <div className="chat-page-container">
      {isSidebarOpen && (
        <div
          className="sidebar-backdrop-mobile"
          onClick={() => setIsSidebarOpen?.(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Glass Sidebar */}
      <aside className={`chat-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <button
            id="btn-new-chat"
            type="button"
            className="new-chat-btn"
            onClick={startNewSession}
            title="Bắt đầu phiên hỏi đáp mới"
          >
            <PlusCircle size={16} />
            <span>Cuộc trò chuyện mới</span>
          </button>
        </div>

        <div className="sessions-search-box">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            className="sessions-search-input"
            placeholder="Tìm lịch sử hội thoại..."
            value={sessionSearch}
            onChange={(e) => setSessionSearch(e.target.value)}
            aria-label="Tìm kiếm cuộc trò chuyện"
          />
          {sessionSearch && (
            <button type="button" className="search-clear-btn" onClick={() => setSessionSearch('')} aria-label="Xóa tìm kiếm">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="sessions-list-container">
          <div className="sessions-header">
            <span>Lịch sử ({filteredSessions.length})</span>
            {sessions.length > 0 && (
              <button
                id="btn-clear-history"
                type="button"
                className="clear-history-btn"
                onClick={() => setShowClearConfirm(true)}
                title="Xóa toàn bộ lịch sử"
                aria-label="Xóa toàn bộ lịch sử"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {showClearConfirm && (
            <div className="clear-confirm-banner animate-fade-in" role="alert">
              <span>Xóa hết tất cả hội thoại?</span>
              <div className="confirm-btns">
                <button type="button" className="btn-confirm-yes" onClick={handleClearAllSessions}>Xóa</button>
                <button type="button" className="btn-confirm-no" onClick={() => setShowClearConfirm(false)}>Hủy</button>
              </div>
            </div>
          )}

          <div className="sessions-scroll">
            {groupedSessions.map((group) => (
              <div key={group.key}>
                <div className="session-group-label">{group.label}</div>
                {group.items.map((s) => {
                  const isCurrent = s.id === currentSessionId;
                  const isEditing = editingSessionId === s.id;
                  const isPinned = pinnedIds.includes(s.id);

                  return (
                    <div
                      key={s.id}
                      className={`session-item ${isCurrent ? 'active' : ''}`}
                      onClick={() => !isEditing && switchSession(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isEditing) switchSession(s.id);
                      }}
                    >
                      <MessageSquare size={14} className="session-icon" />
                      {isEditing ? (
                        <div className="session-rename-form" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            className="session-rename-input"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(s.id, e);
                              if (e.key === 'Escape') handleCancelRename(e);
                            }}
                            autoFocus
                          />
                          <button type="button" className="rename-action-btn check" onClick={(e) => handleSaveRename(s.id, e)}>
                            <Check size={12} />
                          </button>
                          <button type="button" className="rename-action-btn cancel" onClick={handleCancelRename}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="session-title" title={s.title}>{s.title}</span>
                          <div className="session-item-actions">
                            <button
                              type="button"
                              className={`session-pin-btn ${isPinned ? 'pinned' : ''}`}
                              onClick={(e) => handleTogglePin(s.id, e)}
                              title={isPinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                              aria-label="Pin session"
                            >
                              <Pin size={11} />
                            </button>
                            <button
                              type="button"
                              className="session-edit-btn"
                              onClick={(e) => handleStartRename(s, e)}
                              title="Đổi tên"
                              aria-label="Rename session"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              type="button"
                              className="session-delete-btn"
                              onClick={(e) => deleteSingleSession(s.id, e)}
                              title="Xóa"
                              aria-label="Delete session"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {filteredSessions.length === 0 && (
              <div className="empty-sessions">
                {sessionSearch ? 'Không tìm thấy cuộc trò chuyện phù hợp.' : 'Chưa có cuộc trò chuyện nào.'}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-info-card">
          <div className="info-card-header">
            <BookOpen size={14} className="text-brand" />
            <span>Kho văn bản chính thức VKU</span>
          </div>
          <p>
            Trả lời dựa trên quy chế tín chỉ, học phí và đề án tuyển sinh VKU kèm dẫn nguồn kiểm chứng.
          </p>
          <div className="info-badge-row">
            <span className="info-chip">Hybrid RAG</span>
            <span className="info-chip">SSE Stream</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Glass Stage */}
      <main className="chat-main-area">
        {messages.length > 0 && (
          <div className="chat-content-header-bar">
            <div className="chat-header-session-info">
              <span className="chat-header-session-title">
                {sessions.find((s) => s.id === currentSessionId)?.title || 'Hội thoại'}
              </span>
              <span className="chat-header-message-count">
                ({messages.length} lượt tương tác)
              </span>
            </div>

            <button
              type="button"
              className="export-chat-btn"
              onClick={handleExportChat}
              title="Xuất biên bản hội thoại ra file Markdown (.md)"
            >
              <Download size={13} />
              <span>Xuất hội thoại</span>
            </button>
          </div>
        )}

        {messages.length === 0 && !isLoading && !error ? (
          <div className="chat-welcome-hero animate-fade-in">
            <div className="welcome-academic-seal">
              <GraduationCap size={34} />
            </div>
            <h2>Trợ lý Học vụ & Tuyển sinh VKU</h2>
            <p className="welcome-subtitle">
              Hỗ trợ hỏi đáp đa lượt kèm kiểm chứng trích dẫn văn bản quy chế đào tạo tín chỉ, học phí, học bổng và tuyển sinh Đại học VKU.
            </p>

            <div className="welcome-grid">
              <div
                className="welcome-card"
                onClick={() => handleSendMessage('Học phí và chính sách học bổng năm 2026?')}
                role="button"
                tabIndex={0}
              >
                <div className="card-top-icon green"><Award size={18} /></div>
                <h4>Học phí & Chính sách học bổng</h4>
                <p>Mức thu học phí theo tín chỉ 2026 và học bổng tài trợ (Hanwha, KOICA, LG).</p>
              </div>

              <div
                className="welcome-card"
                onClick={() => handleSendMessage('5 phương thức xét tuyển Đại học VKU')}
                role="button"
                tabIndex={0}
              >
                <div className="card-top-icon blue"><Calendar size={18} /></div>
                <h4>5 phương thức tuyển sinh Đại học</h4>
                <p>Xét tuyển thẳng, học bạ, ĐGNL, chứng chỉ IELTS/TOPIK và điểm THPT.</p>
              </div>

              <div
                className="welcome-card"
                onClick={() => handleSendMessage('Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp')}
                role="button"
                tabIndex={0}
              >
                <div className="card-top-icon cyan"><BookCheck size={18} /></div>
                <h4>Chuẩn đầu ra TOEIC & Chuẩn CNTT</h4>
                <p>Điều kiện tiếng Anh (TOEIC 550+ / IELTS), TOPIK và chứng chỉ tin học.</p>
              </div>

              <div
                className="welcome-card"
                onClick={() => handleSendMessage('Điều kiện bị cảnh báo học vụ và thôi học?')}
                role="button"
                tabIndex={0}
              >
                <div className="card-top-icon amber"><FileSpreadsheet size={18} /></div>
                <h4>Quy chế cảnh báo học vụ & Điểm F</h4>
                <p>Ngưỡng GPA tối thiểu theo năm học, giới hạn tín chỉ nợ và thôi học.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-messages-scroll" ref={messagesScrollRef} onScroll={handleScroll}>
            {messages.map((msg, idx) => {
              const msgKey = msg.message_id || msg.timestamp || idx;
              return (
                <ChatMessage
                  key={msgKey}
                  message={msg}
                  onOpenFeedback={(m, rating) => setFeedbackTarget({ ...m, initialRating: rating })}
                  onInspectSource={(src) => setInspectedSource(src)}
                  onSelectFollowup={(q) => handleSendMessage(q)}
                  isSaved={savedMsgIds.has(msg.message_id || msg.timestamp)}
                  onToggleSave={handleToggleSaveMessage}
                />
              );
            })}

            {isLoading && !messages.some((m) => m.isStreaming) && (
              <div className="message-wrapper bot-message animate-fade-in">
                <div className="avatar-box bot">
                  <GraduationCap size={18} />
                </div>
                <div className="message-content-container">
                  <div className="message-bubble loading-bubble">
                    <div className="loading-dots-row">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="loading-text">Đang đối chiếu văn bản quy chế và tổng hợp nội dung...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="chat-error-banner animate-slide-up">
                <div className="error-icon-col"><AlertOctagon size={22} className="text-danger" /></div>
                <div className="error-text-col">
                  <h4>Không thể xử lý yêu cầu ({error.code})</h4>
                  <p>{error.message}</p>
                  {error.requestId && <span className="error-req-id">Request ID: {error.requestId}</span>}
                </div>
                {error.lastQuestion && (
                  <button type="button" className="error-retry-btn" onClick={handleRetry}>
                    <RefreshCw size={14} />
                    <span>Thử lại</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {showScrollBottom && (
          <button
            type="button"
            className="scroll-to-bottom-btn animate-fade-in"
            onClick={() => scrollToBottom(true)}
            aria-label="Cuộn xuống cuối"
          >
            <ArrowDown size={14} />
            <span>Mới nhất</span>
          </button>
        )}

        <ChatInput
          onSendMessage={(txt) => handleSendMessage(txt)}
          isLoading={isLoading}
          onAbort={handleAbortGeneration}
          category={category}
          setCategory={setCategory}
          applicableYear={applicableYear}
          setApplicableYear={setApplicableYear}
          scopedDocument={scopedDocument}
          onClearScopedDocument={() => setScopedDocument(null)}
        />
      </main>

      {/* Right-side Liquid Glass Citation Split-View Inspector */}
      {inspectedSource && (
        <CitationInspector
          source={inspectedSource}
          onClose={() => setInspectedSource(null)}
        />
      )}

      {feedbackTarget && (
        <FeedbackModal
          message={feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
