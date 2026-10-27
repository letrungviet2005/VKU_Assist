import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export function FeedbackModal({ message, onClose }) {
  const [rating, setRating] = useState(message.initialRating || 'helpful');
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await api.sendFeedback({
      messageId: message.message_id || 'msg_' + Date.now(),
      rating,
      comment: comment.trim(),
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Đánh giá phản hồi trợ lý ảo</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
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

            <div className="rating-toggle-group">
              <button
                type="button"
                className={`rating-btn ${rating === 'helpful' ? 'active helpful' : ''}`}
                onClick={() => setRating('helpful')}
              >
                <ThumbsUp size={18} />
                <span>Hữu ích & Đúng nguồn</span>
              </button>
              <button
                type="button"
                className={`rating-btn ${rating === 'not_helpful' ? 'active not-helpful' : ''}`}
                onClick={() => setRating('not_helpful')}
              >
                <ThumbsDown size={18} />
                <span>Chưa thỏa đáng</span>
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="feedback-comment">Góp ý thêm (không bắt buộc):</label>
              <textarea
                id="feedback-comment"
                rows={3}
                placeholder="VD: Câu trả lời chưa rõ điều kiện năm 2026, cần bổ sung bảng điểm..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
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
