import { X, BookOpen, Calendar, Hash, ExternalLink, Copy, Check, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function CitationInspector({ source, onClose }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  if (!source) return null;

  const handleCopy = () => {
    const text = `[${source.source_id}] ${source.title} (${source.page_or_section || 'Văn bản'}) - ${source.snippet || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="citation-inspector-drawer animate-slide-up" aria-label="Chi tiết căn cứ văn bản">
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="source-badge">{source.source_id || 'S1'}</span>
          <strong style={{ fontSize: 13.5 }}>Kiểm chứng Căn cứ RAG</strong>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng inspector">
          <X size={16} />
        </button>
      </div>

      <div className="inspector-body">
        <div>
          <span className="page-eyebrow">Văn bản trích dẫn</span>
          <h3 style={{ fontSize: 15.5, lineHeight: 1.35 }}>{source.title}</h3>
        </div>

        <div className="source-meta-row">
          {source.page_or_section && (
            <span className="source-meta-tag">
              <BookOpen size={11} />
              <span>{typeof source.page_or_section === 'number' ? `Trang ${source.page_or_section}` : source.page_or_section}</span>
            </span>
          )}
          {source.applicable_year && (
            <span className="source-meta-tag">
              <Calendar size={11} />
              <span>Năm {source.applicable_year}</span>
            </span>
          )}
          {source.document_version && (
            <span className="source-meta-tag">
              <Hash size={11} />
              <span>{source.document_version}</span>
            </span>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }} className="text-muted">
            ĐOẠN VĂN BẢN ĐỐI CHIẾU ({source.chunk_id})
          </div>
          <div className="inspector-excerpt-box">
            {source.snippet
              ? source.snippet
              : 'Đoạn trích này được truy xuất từ chỉ mục FAISS và đối chiếu để sinh câu trả lời. Bạn có thể mở tài liệu trong Kho văn bản hoặc xem văn bản gốc bên dưới.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
          <button type="button" className="btn-secondary" onClick={handleCopy} style={{ width: '100%' }}>
            {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
            <span>{copied ? 'Đã sao chép trích dẫn' : 'Sao chép trích dẫn & nội dung'}</span>
          </button>

          {source.document_id && (
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => navigate(`/library?doc=${encodeURIComponent(source.document_id)}`)}
            >
              <ArrowUpRight size={14} />
              <span>Mở trong Kho Văn bản</span>
            </button>
          )}

          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{ width: '100%', textDecoration: 'none' }}
            >
              <ExternalLink size={14} />
              <span>Xem văn bản gốc VKU</span>
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
