import { useState, useRef, useEffect } from 'react';
import {
  Send,
  HelpCircle,
  Filter,
  Calendar,
  X,
  Square,
  CornerDownLeft,
  GraduationCap,
  Award,
  BookCheck,
  FileSpreadsheet,
  Lock,
} from 'lucide-react';

const SUGGESTIONS = [
  { text: 'Học phí và chính sách học bổng năm 2026?', icon: Award, tag: 'Học phí' },
  { text: '5 phương thức xét tuyển Đại học VKU', icon: GraduationCap, tag: 'Tuyển sinh' },
  { text: 'Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp', icon: BookCheck, tag: 'Chuẩn đầu ra' },
  { text: 'Điều kiện bị cảnh báo học vụ và thôi học?', icon: FileSpreadsheet, tag: 'Quy chế' },
];

export function ChatInput({
  onSendMessage,
  isLoading,
  onAbort,
  category,
  setCategory,
  applicableYear,
  setApplicableYear,
  scopedDocument,
  onClearScopedDocument,
}) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
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

  const handleClearText = () => {
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const charCount = text.length;
  const isWarning = charCount >= 1800 && charCount <= 2000;
  const isOverLimit = charCount > 2000;

  return (
    <div className="chat-input-wrapper">
      {/* Quick Suggestions Chips */}
      <div className="suggestions-scroll" role="region" aria-label="Gợi ý câu hỏi nhanh">
        <span className="suggestions-label">
          <HelpCircle size={13} className="text-brand" />
          <span>Gợi ý:</span>
        </span>
        {SUGGESTIONS.map((s, idx) => {
          const Icon = s.icon;
          return (
            <button
              key={idx}
              type="button"
              className="suggestion-chip"
              onClick={() => !isLoading && onSendMessage(s.text)}
              disabled={isLoading}
              title={`Hỏi câu: ${s.text}`}
            >
              <Icon size={12} className="chip-icon" />
              <span>{s.text}</span>
            </button>
          );
        })}
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
            aria-label="Lọc phạm vi tra cứu tài liệu"
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
            aria-label="Lọc theo năm áp dụng văn bản"
          >
            <option value="">Mọi năm áp dụng</option>
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
            <option value="2024">Năm 2024</option>
          </select>
        </div>

        {scopedDocument && (
          <span className="scope-lock-pill" title={`Đang hỏi riêng trong tài liệu: ${scopedDocument.title}`}>
            <Lock size={11} />
            <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Trong: {scopedDocument.title}
            </span>
            <button type="button" onClick={onClearScopedDocument} aria-label="Bỏ khóa tài liệu">
              <X size={12} />
            </button>
          </span>
        )}

        {(category || applicableYear) && (
          <button
            type="button"
            className="clear-filter-btn"
            onClick={() => {
              setCategory(null);
              setApplicableYear(null);
            }}
            aria-label="Xóa bộ lọc"
          >
            <X size={12} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Liquid Glass Composer Dock */}
      <form onSubmit={handleSubmit} className="input-card">
        <div className="textarea-row">
          <textarea
            id="chat-textarea"
            ref={textareaRef}
            rows={1}
            placeholder="Hỏi VKU Assist về học vụ, quy chế, học bổng, điểm rèn luyện, tuyển sinh..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            maxLength={2100}
            aria-label="Nội dung câu hỏi tra cứu"
          />

          {text.trim() && !isLoading && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={handleClearText}
              title="Xóa nhanh nội dung đã nhập"
              aria-label="Clear input text"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="input-actions-row">
          <div className="keyboard-shortcut-hint">
            <CornerDownLeft size={11} />
            <span>Enter gửi · Shift+Enter xuống dòng · ⌘K tìm nhanh</span>
          </div>

          <div className="input-right-actions">
            <span
              className={`char-counter ${isOverLimit ? 'over-limit' : isWarning ? 'warning-limit' : ''}`}
              title="Số ký tự tối đa 2000"
            >
              {charCount}/2000
            </span>

            {isLoading ? (
              <button
                type="button"
                id="btn-abort-chat"
                className="send-button abort-button"
                onClick={onAbort}
                title="Dừng tạo phản hồi"
                aria-label="Dừng tạo phản hồi"
              >
                <Square size={13} fill="currentColor" />
                <span className="abort-label">Dừng</span>
              </button>
            ) : (
              <button
                type="submit"
                id="btn-send-chat"
                className="send-button"
                disabled={!text.trim() || isOverLimit}
                title="Gửi câu hỏi"
                aria-label="Gửi câu hỏi"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      </form>

      <div className="input-disclaimer">
        Hệ thống trả lời đối chiếu từ kho văn bản chính thức VKU. Luôn kiểm tra trích dẫn nguồn [S1], [S2] khi áp dụng.
      </div>
    </div>
  );
}
