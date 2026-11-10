import { useState, useEffect } from 'react';
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
  FileCheck,
  Volume2,
  VolumeX,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SourceCard } from './SourceCard';

export function ChatMessage({
  message,
  onOpenFeedback,
  onInspectSource,
  onSelectFollowup,
  isSaved = false,
  onToggleSave,
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [highlightedSourceId, setHighlightedSourceId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCitationClick = (sourceId) => {
    setHighlightedSourceId(sourceId);
    const matched = (message.sources || []).find((s) => s.source_id === sourceId);
    if (matched && onInspectSource) {
      onInspectSource(matched);
    }
    setTimeout(() => {
      setHighlightedSourceId(null);
    }, 3000);
  };

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt của bạn chưa hỗ trợ tính năng đọc văn bản (Web Speech API).');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const cleanText = (message.content || '')
      .replace(/\[S\d+\]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*#`_>|]/g, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.startsWith('vi') || v.name.includes('Vietnamese') || v.name.includes('Vietnam'));
    if (viVoice) utterance.voice = viVoice;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const getStatusBadge = () => {
    switch (message.status) {
      case 'answered':
        return (
          <span className="status-badge answered" title="Câu trả lời được đối chiếu chính xác từ văn bản chính thức VKU">
            <CheckCircle2 size={13} />
            <span>Có căn cứ chính thức</span>
          </span>
        );
      case 'needs_clarification':
        return (
          <span className="status-badge clarification" title="Câu hỏi cần thêm chi tiết như ngành, hệ đào tạo hoặc năm áp dụng">
            <HelpCircle size={13} />
            <span>Cần làm rõ thông tin</span>
          </span>
        );
      case 'insufficient_evidence':
        return (
          <span className="status-badge insufficient" title="Dữ liệu chưa được ban hành trong văn bản chính thức của Nhà trường">
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
          <div className="avatar-box user" title="Sinh viên / Người dùng">
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
          {!isUser && message.status && (
            <div className="bot-status-header">
              {getStatusBadge()}
              {message.generation_mode && (
                <span className="mode-badge" title="Chế độ tổng hợp phản hồi">
                  <FileCheck size={11} />
                  <span>
                    {message.generation_mode === 'fake'
                      ? 'CHẾ ĐỘ THỬ NGHIỆM (FAKE)'
                      : message.generation_mode === 'extractive'
                        ? 'TRÍCH XUẤT RAG CỤC BỘ'
                        : 'AMAZON BEDROCK'}
                  </span>
                </span>
              )}
            </div>
          )}

          <div className="message-text">
            <MarkdownRenderer
              content={message.content}
              onCitationClick={handleCitationClick}
            />
          </div>

          {!isUser && message.sources && message.sources.length > 0 && (
            <SourceCard
              sources={message.sources}
              highlightedSourceId={highlightedSourceId}
              onInspectSource={onInspectSource}
            />
          )}
        </div>

        {!isUser && !message.isStreaming && (
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
              {onToggleSave && (
                <button
                  type="button"
                  className={`action-btn ${isSaved ? 'bookmarked' : ''}`}
                  onClick={() => onToggleSave(message)}
                  title={isSaved ? 'Đã lưu vào mục Đã lưu' : 'Lưu câu trả lời & nguồn tham khảo'}
                  aria-label="Lưu câu trả lời"
                >
                  <Bookmark size={14} />
                  <span>{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                </button>
              )}

              <button
                type="button"
                className={`action-btn speaker-btn ${isSpeaking ? 'speaking' : ''}`}
                onClick={handleToggleSpeech}
                title={isSpeaking ? 'Dừng đọc' : 'Đọc câu trả lời bằng giọng nói'}
                aria-label="Text to speech"
              >
                {isSpeaking ? <VolumeX size={14} className="text-danger" /> : <Volume2 size={14} />}
                <span>{isSpeaking ? 'Dừng đọc' : 'Đọc'}</span>
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={handleCopy}
                title="Sao chép nội dung câu trả lời"
                aria-label="Copy message"
              >
                {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={() => onOpenFeedback(message, 'helpful')}
                title="Hài lòng với câu trả lời"
                aria-label="Thích câu trả lời"
              >
                <ThumbsUp size={14} />
              </button>

              <button
                type="button"
                className="action-btn"
                onClick={() => onOpenFeedback(message, 'not_helpful')}
                title="Chưa hài lòng hoặc sai thông tin"
                aria-label="Không thích câu trả lời"
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        )}

        {!isUser && !message.isStreaming && message.followups && message.followups.length > 0 && onSelectFollowup && (
          <div className="followup-chips-row">
            {message.followups.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="followup-chip-btn"
                onClick={() => onSelectFollowup(q)}
              >
                <Sparkles size={11} className="text-brand" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}

        <div className="message-time">
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  );
}
