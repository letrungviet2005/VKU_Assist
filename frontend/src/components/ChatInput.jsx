import { useState, useRef, useEffect } from 'react';
import { Send, HelpCircle, Filter, Calendar, X } from 'lucide-react';

const SUGGESTIONS = [
  "Học phí và chính sách học bổng năm 2026?",
  "5 phương thức xét tuyển Đại học VKU",
  "Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp",
  "Điều kiện bị cảnh báo học vụ và thôi học?"
];

export function ChatInput({ 
  onSendMessage, 
  isLoading, 
  category, 
  setCategory, 
  applicableYear, 
  setApplicableYear 
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectSuggestion = (prompt) => {
    onSendMessage(prompt);
  };

  const charCount = text.length;
  const isOverLimit = charCount > 2000;

  return (
    <div className="chat-input-wrapper">
      {/* Quick Suggestions Chips */}
      <div className="suggestions-scroll">
        <span className="suggestions-label">
          <HelpCircle size={13} className="text-cyan" />
          <span>Câu hỏi mẫu:</span>
        </span>
        {SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            type="button"
            className="suggestion-chip"
            onClick={() => handleSelectSuggestion(s)}
            disabled={isLoading}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Filter Options Bar */}
      <div className="input-filter-bar">
        <div className="filter-item">
          <Filter size={13} className="filter-icon" />
          <select
            id="select-category"
            value={category || ''}
            onChange={(e) => setCategory(e.target.value || null)}
            className="filter-select"
            title="Lọc phạm vi tra cứu tài liệu"
          >
            <option value="">Tất cả danh mục</option>
            <option value="academic">Học vụ & Đào tạo</option>
            <option value="admissions">Tuyển sinh & Học bổng</option>
          </select>
        </div>

        <div className="filter-item">
          <Calendar size={13} className="filter-icon" />
          <select
            id="select-year"
            value={applicableYear || ''}
            onChange={(e) => setApplicableYear(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="filter-select"
            title="Lọc theo năm áp dụng văn bản"
          >
            <option value="">Mọi năm áp dụng</option>
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
            <option value="2024">Năm 2024</option>
          </select>
        </div>

        {(category || applicableYear) && (
          <button
            type="button"
            className="clear-filter-btn"
            onClick={() => {
              setCategory(null);
              setApplicableYear(null);
            }}
            title="Xóa bộ lọc"
          >
            <X size={12} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="input-card">
        <textarea
          id="chat-textarea"
          ref={textareaRef}
          rows={1}
          placeholder="Hỏi VKU Assist về học vụ, quy chế, học bổng, tuyển sinh..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          maxLength={2000}
        />

        <div className="input-actions-row">
          <span className={`char-counter ${isOverLimit ? 'over-limit' : ''}`}>
            {charCount}/2000
          </span>

          <button
            id="btn-send-message"
            type="submit"
            className="send-button"
            disabled={!text.trim() || isLoading || isOverLimit}
            aria-label="Gửi câu hỏi"
            title="Gửi câu hỏi (Enter)"
          >
            {isLoading ? (
              <span className="btn-spinner"></span>
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>

      <div className="input-disclaimer">
        <span>Thông tin được đối chiếu từ văn bản chính thức của VKU. Vui lòng xem nguồn đính kèm để đối chiếu.</span>
      </div>
    </div>
  );
}
