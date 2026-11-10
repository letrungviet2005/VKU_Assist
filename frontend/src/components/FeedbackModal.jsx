import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, X, Send, CheckCircle2, Tag } from 'lucide-react';
import { api } from '../services/api';

const HELPFUL_TAGS = [
  'Thông tin chính xác',
  'Dẫn nguồn đầy đủ',
  'Giải thích rõ ràng',
  'Đúng trọng tâm câu hỏi',
  'Cập nhật năm 2026'
];

const NOT_HELPFUL_TAGS = [
  'Sai năm áp dụng',
  'Thiếu điều khoản quy chế',
  'Chưa đúng trọng tâm câu hỏi',
  'Nguồn trích dẫn không khớp',
  'Thông tin chưa đầy đủ'
];

export function FeedbackModal({ message, onClose }) {
  const [rating, setRating] = useState(message.initialRating || 'helpful');
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // When rating changes, reset selected tags
  const handleRatingChange = (newRating) => {
    setRating(newRating);
    setSelectedTags([]);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const fullComment = [
      selectedTags.length > 0 ? `[Tiêu chí: ${selectedTags.join(', ')}]` : '',
      comment.trim(),
    ]
      .filter(Boolean)
      .join(' - ');

    await api.sendFeedback({
      messageId: message.message_id || 'msg_' + Date.now(),
      rating,
      comment: fullComment,
    });

    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1400);
  };

  const currentTags = rating === 'helpful' ? HELPFUL_TAGS : NOT_HELPFUL_TAGS;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card animate-slide-up" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
      >
        <div className="modal-header">
          <h3 id="feedback-dialog-title">Đánh giá phản hồi trợ lý ảo VKU</h3>
          <button 
            type="button"
            className="modal-close-btn" 
            onClick={onClose} 
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="modal-success-state animate-fade-in">
            <CheckCircle2 size={44} className="text-emerald" />
            <h4>Cảm ơn bạn đã đóng góp ý kiến!</h4>
            <p>Phản hồi của bạn giúp VKU Assist ngày càng hoàn thiện và chính xác hơn.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            <p className="modal-desc">
              Ý kiến của bạn là căn cứ quan trọng để đánh giá độ chính xác và chất lượng dẫn nguồn theo đề án VKU.
            </p>

            <div className="rating-toggle-group" role="group" aria-label="Mức độ hài lòng">
              <button
                type="button"
                className={`rating-btn ${rating === 'helpful' ? 'active helpful' : ''}`}
                onClick={() => handleRatingChange('helpful')}
              >
                <ThumbsUp size={18} />
                <span>Hài lòng & Đúng nguồn</span>
              </button>
              <button
                type="button"
                className={`rating-btn ${rating === 'not_helpful' ? 'active not-helpful' : ''}`}
                onClick={() => handleRatingChange('not_helpful')}
              >
                <ThumbsDown size={18} />
                <span>Chưa thỏa đáng</span>
              </button>
            </div>

            {/* Quick Tags Section */}
            <div className="feedback-tags-section">
              <div className="feedback-tags-label">
                <Tag size={12} className="text-muted" />
                <span>Chọn lý do đánh giá nhanh:</span>
              </div>
              <div className="feedback-tags-list">
                {currentTags.map((tag, idx) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`feedback-tag-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="feedback-comment">Góp ý thêm (không bắt buộc):</label>
              <textarea
                id="feedback-comment"
                rows={3}
                placeholder={
                  rating === 'helpful'
                    ? 'VD: Câu trả lời rất súc tích, trích dẫn đúng biểu phí năm 2026...'
                    : 'VD: Câu trả lời chưa nêu điều kiện học bổng Hanwha, cần thêm số trang quy chế...'
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
              />
              <div className="textarea-footer-info">
                <span className="char-counter">{comment.length} / 500</span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                <Send size={15} />
                <span>{submitting ? 'Đang gửi...' : 'Gửi đánh giá'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
