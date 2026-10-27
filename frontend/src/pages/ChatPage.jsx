import { useState, useEffect, useRef } from 'react';
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
  FileSpreadsheet
} from 'lucide-react';
import { ChatMessage } from '../components/ChatMessage';
import { ChatInput } from '../components/ChatInput';
import { FeedbackModal } from '../components/FeedbackModal';
import { api } from '../services/api';
import { storage } from '../services/storage';

export function ChatPage({ isMockMode, isSidebarOpen }) {
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
    const saved = storage.getChatSessions();
    return saved && saved.length > 0 ? saved[0].id : null;
  });

  const [messages, setMessages] = useState(() => {
    const saved = storage.getChatSessions();
    return saved && saved.length > 0 ? saved[0].messages || [] : [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(null);
  const [applicableYear, setApplicableYear] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const messagesEndRef = useRef(null);

  // Sync current messages to active session in storage
  const updateCurrentSessionMessages = (newMessages) => {
    setMessages(newMessages);
    if (!currentSessionId) return;

    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === currentSessionId) {
          const firstUserMsg = newMessages.find((m) => m.role === 'user');
          const title = firstUserMsg ? firstUserMsg.content.substring(0, 36) : 'Cuộc trò chuyện mới';
          return { ...s, title, messages: newMessages, updatedAt: new Date().toISOString() };
        }
        return s;
      });
      storage.saveChatSessions(updated);
      return updated;
    });
  };

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const startNewSession = () => {
    const newId = 'session_' + Date.now();
    const newSession = {
      id: newId,
      title: 'Cuộc trò chuyện mới',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions((prev) => {
      const updated = [newSession, ...prev];
      storage.saveChatSessions(updated);
      return updated;
    });
    setCurrentSessionId(newId);
    setMessages([]);
    setError(null);
  };

  const switchSession = (sessionId) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setCurrentSessionId(sessionId);
      setMessages(target.messages || []);
      setError(null);
    }
  };

  // Delete an individual chat session
  const deleteSingleSession = (sessionId, e) => {
    e.stopPropagation();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    storage.saveChatSessions(remaining);
    setSessions(remaining);

    if (currentSessionId === sessionId) {
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      } else {
        startNewSession();
      }
    }
  };

  // Clear all sessions
  const handleClearAllSessions = () => {
    storage.saveChatSessions([]);
    setSessions([]);
    setShowClearConfirm(false);
    startNewSession();
  };

  const handleSendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMsgsWithUser = [...messages, userMsg];
    updateCurrentSessionMessages(newMsgsWithUser);
    setIsLoading(true);

    try {
      const response = await api.sendChat({
        message: text,
        category,
        applicable_year: applicableYear,
        isMock: isMockMode,
      });

      const botMsg = {
        role: 'assistant',
        content: response.answer,
        status: response.status,
        sources: response.sources || [],
        message_id: response.message_id,
        request_id: response.request_id,
        index_version: response.index_version,
        generation_mode: response.generation_mode,
        timestamp: new Date().toISOString(),
      };

      updateCurrentSessionMessages([...newMsgsWithUser, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setError({
        code: err.code || 'error',
        message: err.message || 'Không thể kết nối đến máy chủ hỏi đáp.',
        status: err.status,
        requestId: err.requestId,
        lastQuestion: text,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (error?.lastQuestion) {
      const lastQ = error.lastQuestion;
      setError(null);
      handleSendMessage(lastQ);
    }
  };

  return (
    <div className="chat-page-container">
      {/* Sidebar - Sessions & Context Info (Always fixed height, never scrolls with chat) */}
      <aside className={`chat-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-top">
          <button 
            id="btn-new-chat" 
            className="new-chat-btn" 
            onClick={startNewSession}
          >
            <PlusCircle size={16} />
            <span>Tạo cuộc trò chuyện mới</span>
          </button>
        </div>

        <div className="sessions-list-container">
          <div className="sessions-header">
            <span>Lịch sử hội thoại ({sessions.length})</span>
            {sessions.length > 0 && (
              <button 
                id="btn-clear-history"
                className="clear-history-btn" 
                onClick={() => setShowClearConfirm(true)}
                title="Xóa toàn bộ lịch sử"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {/* Confirm Clear Modal/Banner */}
          {showClearConfirm && (
            <div className="clear-confirm-banner animate-fade-in">
              <span>Xóa hết lịch sử chat?</span>
              <div className="confirm-btns">
                <button type="button" className="btn-confirm-yes" onClick={handleClearAllSessions}>
                  Xóa
                </button>
                <button type="button" className="btn-confirm-no" onClick={() => setShowClearConfirm(false)}>
                  Hủy
                </button>
              </div>
            </div>
          )}

          <div className="sessions-scroll">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
                onClick={() => switchSession(s.id)}
              >
                <MessageSquare size={14} className="session-icon" />
                <span className="session-title" title={s.title}>{s.title}</span>
                <button
                  type="button"
                  className="session-delete-btn"
                  onClick={(e) => deleteSingleSession(s.id, e)}
                  title="Xóa đoạn chat này"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="empty-sessions">Chưa có cuộc trò chuyện nào</div>
            )}
          </div>
        </div>

        {/* System Info Box: Cố định dưới đáy sidebar, không bao giờ bị cuộn theo chat */}
        <div className="sidebar-info-card">
          <div className="info-card-header">
            <BookOpen size={15} className="text-cyan" />
            <span>Kho văn bản chính thức VKU</span>
          </div>
          <p>
            Dữ liệu được trích xuất từ quy chế đào tạo, thông báo học phí và đề án tuyển sinh chính thức của Nhà trường.
          </p>
          <div className="info-badge-row">
            <span className="info-chip">Chỉ mục FAISS</span>
            <span className="info-chip">Nguồn đối chiếu</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Content */}
      <main className="chat-main-area">
        {messages.length === 0 && !isLoading && !error ? (
          /* Empty Chat Welcome Hero - Academic Style */
          <div className="chat-welcome-hero animate-fade-in">
            <div className="welcome-academic-seal">
              <GraduationCap size={40} className="seal-icon" />
            </div>
            <h2>Cổng tra cứu Thông tin Học vụ & Tuyển sinh VKU</h2>
            <p className="welcome-subtitle">
              Hệ thống hỗ trợ sinh viên và thí sinh tra cứu nhanh các văn bản quy chế đào tạo tín chỉ, quy định học phí, chính sách học bổng và các phương thức tuyển sinh Đại học chính quy VKU.
            </p>

            <div className="welcome-grid">
              <div 
                className="welcome-card" 
                onClick={() => handleSendMessage('Học phí và chính sách học bổng năm 2026?')}
              >
                <div className="card-top-icon green">
                  <Award size={18} />
                </div>
                <h4>Học phí & Chính sách học bổng</h4>
                <p>Mức thu học phí theo tín chỉ năm 2026 và các học bổng tài trợ doanh nghiệp (Hanwha, KOICA).</p>
              </div>

              <div 
                className="welcome-card" 
                onClick={() => handleSendMessage('5 phương thức xét tuyển Đại học VKU')}
              >
                <div className="card-top-icon blue">
                  <Calendar size={18} />
                </div>
                <h4>5 phương thức tuyển sinh Đại học</h4>
                <p>Quy định chi tiết về xét tuyển thẳng, điểm thi THPT, thi ĐGNL và xét tuyển học bạ.</p>
              </div>

              <div 
                className="welcome-card" 
                onClick={() => handleSendMessage('Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp')}
              >
                <div className="card-top-icon cyan">
                  <BookCheck size={18} />
                </div>
                <h4>Chuẩn đầu ra TOEIC & Chuẩn CNTT</h4>
                <p>Yêu cầu chứng chỉ tiếng Anh (TOEIC 550+ / IELTS) và chuẩn kỹ năng CNTT để tốt nghiệp.</p>
              </div>

              <div 
                className="welcome-card" 
                onClick={() => handleSendMessage('Điều kiện bị cảnh báo học vụ và thôi học?')}
              >
                <div className="card-top-icon amber">
                  <FileSpreadsheet size={18} />
                </div>
                <h4>Quy chế cảnh báo học vụ & Điểm F</h4>
                <p>Quy định về GPA tối thiểu từng năm, số tín chỉ nợ và điều kiện xử lý học vụ theo tín chỉ.</p>
              </div>
            </div>
          </div>
        ) : (
          /* Messages List - Scrolls independently */
          <div className="chat-messages-scroll">
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.message_id || idx}
                message={msg}
                onOpenFeedback={(m, rating) => setFeedbackTarget({ ...m, initialRating: rating })}
              />
            ))}

            {/* Shimmering Loading State */}
            {isLoading && (
              <div className="message-wrapper bot-message animate-fade-in">
                <div className="avatar-box bot">
                  <span className="dot-spin"></span>
                </div>
                <div className="message-content-container">
                  <div className="message-bubble loading-bubble">
                    <div className="loading-dots-row">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="loading-text">Đang đối chiếu văn bản quy chế và tổng hợp nội dung...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="chat-error-banner animate-slide-up">
                <div className="error-icon-col">
                  <AlertOctagon size={22} className="text-danger" />
                </div>
                <div className="error-text-col">
                  <h4>Không thể xử lý yêu cầu ({error.code})</h4>
                  <p>{error.message}</p>
                  {error.requestId && (
                    <span className="error-req-id">Request ID: {error.requestId}</span>
                  )}
                </div>
                {error.lastQuestion && (
                  <button 
                    type="button" 
                    className="error-retry-btn" 
                    onClick={handleRetry}
                    title="Thử gửi lại câu hỏi"
                  >
                    <RefreshCw size={14} />
                    <span>Thử lại</span>
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Form at Bottom - Always fixed at bottom, never pushed down */}
        <ChatInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          category={category}
          setCategory={setCategory}
          applicableYear={applicableYear}
          setApplicableYear={setApplicableYear}
        />
      </main>

      {/* Feedback Dialog */}
      {feedbackTarget && (
        <FeedbackModal
          message={feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </div>
  );
}
