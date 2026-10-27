/**
 * VKU ASSIST - CHAT MESSAGE COMPONENT
 * Người thực hiện: Thanh Vương
 * 
 * Tính năng chính:
 * 1. Hiển thị phân biệt câu hỏi của Sinh viên (User) và câu trả lời của Trợ lý AI (VKU Assistant)
 * 2. Định dạng câu trả lời Markdown an toàn: Tiêu đề, danh sách đầu dòng, bảng biểu, in đậm
 * 3. Hiển thị Badge trạng thái phản hồi chuẩn RAG:
 *    - Đã trả lời có căn cứ (answered)
 *    - Cần làm rõ thêm thông tin (needs_clarification)
 *    - Chưa đủ dữ liệu đối chiếu (insufficient_evidence)
 * 4. Hiển thị danh sách nguồn trích dẫn RAG (SourceCard) với tên văn bản, điều khoản, trích dẫn gốc
 * 5. Các công cụ tương tác: Sao chép nội dung, Đánh giá phản hồi Hữu ích / Không hữu ích (Feedback)
 */

import { useState } from 'react';
import { 
  GraduationCap, 
  User, 
  Copy, 
  Check, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle2, 
  HelpCircle, 
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { SourceCard } from './SourceCard';

/**
 * Format markdown-like text to safe HTML elements
 */
function renderFormattedContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Empty line spacer
    if (!line.trim()) {
      return <div key={idx} className="line-break" />;
    }

    // Unordered list item
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.substring(2);
      return (
        <li key={idx} className="msg-list-item">
          <span dangerouslySetInnerHTML={{ __html: parseBold(content) }} />
        </li>
      );
    }

    // Numbered list item
    const matchNum = line.match(/^(\d+)\.\s+(.*)/);
    if (matchNum) {
      return (
        <div key={idx} className="msg-numbered-item">
          <span className="msg-num-badge">{matchNum[1]}.</span>
          <span dangerouslySetInnerHTML={{ __html: parseBold(matchNum[2]) }} />
        </div>
      );
    }

    // Regular line
    return (
      <p key={idx} className="msg-paragraph" dangerouslySetInnerHTML={{ __html: parseBold(line) }} />
    );
  });
}

function parseBold(str) {
  // Replace **text** with <strong>text</strong>
  return str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

export function ChatMessage({ message, onOpenFeedback }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    switch (message.status) {
      case 'answered':
        return (
          <span className="status-badge answered">
            <CheckCircle2 size={13} />
            <span>Có căn cứ chính thức</span>
          </span>
        );
      case 'needs_clarification':
        return (
          <span className="status-badge clarification">
            <HelpCircle size={13} />
            <span>Cần làm rõ thông tin</span>
          </span>
        );
      case 'insufficient_evidence':
        return (
          <span className="status-badge insufficient">
            <AlertCircle size={13} />
            <span>Chưa đủ căn cứ văn bản</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`message-wrapper ${isUser ? 'user-message' : 'bot-message'} animate-slide-up`}>
      <div className="message-avatar">
        {isUser ? (
          <div className="avatar-box user">
            <User size={18} />
          </div>
        ) : (
          <div className="avatar-box bot" title="Trợ lý Học vụ VKU">
            <GraduationCap size={18} />
          </div>
        )}
      </div>

      <div className="message-content-container">
        <div className="message-bubble">
          {/* Status Header for Bot */}
          {!isUser && message.status && (
            <div className="bot-status-header">
              {getStatusBadge()}
              {message.generation_mode && (
                <span className="mode-badge" title="Mô hình ngôn ngữ xử lý">
                  <FileCheck size={11} />
                  <span>{message.generation_mode === 'fake' ? 'DỮ LIỆU ĐỐI CHIẾU' : 'BEDROCK AWS'}</span>
                </span>
              )}
            </div>
          )}

          {/* Body Content */}
          <div className="message-text">
            {renderFormattedContent(message.content)}
          </div>

          {/* Sources List */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <SourceCard sources={message.sources} />
          )}
        </div>

        {/* Message Footer / Actions */}
        {!isUser && (
          <div className="message-footer">
            <div className="footer-left-info">
              {message.index_version && (
                <span className="info-tag" title="Phiên bản bộ chỉ mục tri thức">
                  Index: {message.index_version}
                </span>
              )}
              {message.request_id && (
                <span className="info-tag" title={`Request ID: ${message.request_id}`}>
                  Req: {message.request_id.substring(0, 8)}...
                </span>
              )}
            </div>

            <div className="footer-actions">
              <button
                type="button"
                className="action-btn"
                onClick={handleCopy}
                title="Sao chép nội dung"
              >
                {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={() => onOpenFeedback(message, 'helpful')}
                title="Hài lòng với câu trả lời"
              >
                <ThumbsUp size={14} />
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={() => onOpenFeedback(message, 'not_helpful')}
                title="Chưa hài lòng / Sai thông tin"
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="message-time">
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  );
}
