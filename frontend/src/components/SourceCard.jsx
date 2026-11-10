import { useState, useEffect } from 'react';
import {
  BookOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Hash,
  Copy,
  Check,
  PanelRightOpen,
} from 'lucide-react';

export function SourceCard({ sources = [], highlightedSourceId = null, onInspectSource }) {
  const [isOpen, setIsOpen] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  const isListVisible = isOpen || Boolean(highlightedSourceId);

  useEffect(() => {
    if (highlightedSourceId) {
      const element = document.getElementById(`source-item-${highlightedSourceId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [highlightedSourceId]);

  if (!sources || sources.length === 0) return null;

  const handleCopyCitation = (src, e) => {
    e.stopPropagation();
    const citationText = `[${src.source_id || 'Nguồn'}] ${src.title || 'Văn bản VKU'} - ${src.page_or_section || 'Nội dung quy định'} (Áp dụng năm: ${src.applicable_year || 'VKU'})`;
    navigator.clipboard.writeText(citationText);
    setCopiedId(src.source_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="sources-container">
      <div
        className="sources-header"
        onClick={() => setIsOpen(!isListVisible)}
        title="Nhấp để ẩn/hiện danh sách nguồn trích dẫn"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isListVisible);
          }
        }}
        aria-expanded={isListVisible}
      >
        <div className="sources-header-title">
          <BookOpen size={15} className="text-brand" />
          <span>Căn cứ văn bản chính thức ({sources.length})</span>
        </div>
        <button
          className="sources-toggle-btn"
          type="button"
          aria-label={isListVisible ? 'Thu gọn danh sách nguồn' : 'Mở rộng danh sách nguồn'}
        >
          {isListVisible ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isListVisible && (
        <div className="sources-list animate-fade-in">
          {sources.map((src, idx) => {
            const sid = src.source_id || `S${idx + 1}`;
            const isHighlighted = highlightedSourceId === sid;

            return (
              <div
                key={src.chunk_id || sid || idx}
                id={`source-item-${sid}`}
                className={`source-item ${isHighlighted ? 'highlighted' : ''}`}
              >
                <div className="source-item-top">
                  <span className="source-badge">{sid}</span>
                  <span className="source-title" title={src.title}>{src.title}</span>

                  <div className="source-actions-mini">
                    {onInspectSource && (
                      <button
                        type="button"
                        className="source-action-btn"
                        onClick={() => onInspectSource(src)}
                        title="Mở Split-View đối chiếu chi tiết đoạn trích"
                        aria-label="Inspect citation"
                      >
                        <PanelRightOpen size={13} />
                        <span>Đối chiếu</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="source-action-btn"
                      onClick={(e) => handleCopyCitation(src, e)}
                      title="Sao chép trích dẫn văn bản này"
                      aria-label="Copy citation"
                    >
                      {copiedId === sid ? (
                        <Check size={12} className="text-emerald" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="source-link"
                        title="Mở văn bản gốc"
                        aria-label="Open document link"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                </div>

                <div className="source-meta-row">
                  {src.page_or_section && (
                    <span className="source-meta-tag">
                      <FileText size={11} />
                      <span>{typeof src.page_or_section === 'number' ? `Trang ${src.page_or_section}` : src.page_or_section}</span>
                    </span>
                  )}
                  {src.applicable_year && (
                    <span className="source-meta-tag year">
                      <Calendar size={11} />
                      <span>Năm {src.applicable_year}</span>
                    </span>
                  )}
                  {src.document_version && (
                    <span className="source-meta-tag version">
                      <Hash size={11} />
                      <span>{src.document_version}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
