import { useState } from 'react';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, FileText, Calendar, Hash } from 'lucide-react';

export function SourceCard({ sources = [] }) {
  const [isOpen, setIsOpen] = useState(true);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="sources-container">
      <div 
        className="sources-header" 
        onClick={() => setIsOpen(!isOpen)}
        title="Nhấp để ẩn/hiện danh sách nguồn trích dẫn"
      >
        <div className="sources-header-title">
          <BookOpen size={16} className="text-cyan" />
          <span>Căn cứ văn bản chính thức ({sources.length})</span>
        </div>
        <button className="sources-toggle-btn" type="button" aria-label="Toggle sources">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="sources-list animate-fade-in">
          {sources.map((src, idx) => (
            <div key={src.chunk_id || idx} className="source-item">
              <div className="source-item-top">
                <span className="source-badge">{src.source_id || `S${idx + 1}`}</span>
                <span className="source-title" title={src.title}>{src.title}</span>
                {src.url && (
                  <a 
                    href={src.url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="source-link"
                    title="Mở tài liệu gốc"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
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
          ))}
        </div>
      )}
    </div>
  );
}
