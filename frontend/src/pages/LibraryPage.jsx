import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Calendar,
  ExternalLink,
  MessageSquare,
  FileText,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

export function LibraryPage({ isMockMode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [indexVersion, setIndexVersion] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState('');
  const [semanticResults, setSemanticResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedDocDetail, setSelectedDocDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getLibraryDocuments({
        category: category || null,
        applicable_year: year ? parseInt(year, 10) : null,
        search: query,
        isMock: isMockMode,
      })
      .then((res) => {
        if (!active) return;
        setDocuments(res.documents || []);
        setIndexVersion(res.index_version || '');
      });
    return () => {
      active = false;
    };
  }, [category, year, query, isMockMode]);

  const openDocumentDetail = async (docId) => {
    setLoadingDetail(true);
    try {
      const detail = await api.getLibraryDocumentDetail(docId, isMockMode);
      setSelectedDocDetail(detail);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    const docParam = searchParams.get('doc');
    if (docParam) {
      openDocumentDetail(docParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSemanticSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) {
      setSemanticResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.searchLibrary({
        query: query.trim(),
        top_k: 6,
        category: category || null,
        applicable_year: year ? parseInt(year, 10) : null,
        isMock: isMockMode,
      });
      setSemanticResults(res.results || []);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAskAboutDocument = (doc) => {
    const titleParam = encodeURIComponent(doc.title);
    const idParam = encodeURIComponent(doc.document_id);
    navigate(`/chat?doc=${idParam}&docTitle=${titleParam}`);
  };

  const closeDetail = () => {
    setSelectedDocDetail(null);
    if (searchParams.get('doc')) {
      searchParams.delete('doc');
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <div className="page-scroll-area">
      <div className="page-container animate-fade-in">
        <header className="page-header-apple">
          <div>
            <div className="page-eyebrow">VKU Knowledge Repository</div>
            <h1>Kho Văn bản & Tra cứu Ngữ nghĩa</h1>
            <p className="page-subtitle">
              Duyệt văn bản quy chế, thông báo học phí, đề án tuyển sinh và tìm kiếm trực tiếp các đoạn trích đã được vector hóa.
            </p>
          </div>
          {indexVersion && (
            <span className="info-chip">Index: {indexVersion}</span>
          )}
        </header>

        {/* Semantic Search + Filter Bar */}
        <form onSubmit={handleSemanticSearch} className="library-search-glass">
          <Search size={18} className="text-brand flex-shrink-0" />
          <input
            type="text"
            placeholder="Nhập từ khóa hoặc câu hỏi để tìm đoạn trích quy chế (VD: TOEIC 550, cảnh báo học vụ, học phí tín chỉ)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value.trim()) setSemanticResults(null);
            }}
            aria-label="Tìm kiếm trong kho văn bản"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery('');
                setSemanticResults(null);
              }}
              aria-label="Xóa từ khóa"
            >
              <X size={15} />
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={isSearching}>
            <Sparkles size={14} />
            <span>{isSearching ? 'Đang tìm...' : 'Tìm đoạn trích'}</span>
          </button>
        </form>

        {/* Glass Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div className="apple-segmented-control">
            {[
              { value: '', label: 'Tất cả' },
              { value: 'academic', label: 'Học vụ & Đào tạo' },
              { value: 'admissions', label: 'Tuyển sinh & Học bổng' },
            ].map((item) => (
              <button
                key={item.value || 'all'}
                type="button"
                className={`apple-segment-btn ${category === item.value ? 'active' : ''}`}
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <Calendar size={14} className="text-muted" />
            <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Lọc theo năm áp dụng">
              <option value="">Mọi năm áp dụng</option>
              <option value="2026">Năm 2026</option>
              <option value="2025">Năm 2025</option>
              <option value="2024">Năm 2024</option>
            </select>
          </div>
        </div>

        {/* Semantic Search Results (when triggered) */}
        {semanticResults !== null && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16 }}>
                Kết quả đoạn trích khớp ngữ nghĩa ({semanticResults.length})
              </h2>
              <button type="button" className="btn-secondary" onClick={() => setSemanticResults(null)}>
                Ẩn kết quả đoạn trích
              </button>
            </div>

            {semanticResults.length === 0 ? (
              <div className="chunk-result-card">
                <p>Không tìm thấy đoạn văn bản phù hợp trong bộ lọc hiện tại.</p>
              </div>
            ) : (
              semanticResults.map((chunk, idx) => (
                <div key={chunk.chunk_id || idx} className="chunk-result-card animate-fade-in">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="source-badge">#{idx + 1}</span>
                      <strong>{chunk.title}</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {typeof chunk.score === 'number' && (
                        <span className="score-pill">
                          {Math.round(Math.min(1, Math.max(0, chunk.score)) * 100)}% khớp
                        </span>
                      )}
                      {chunk.applicable_year && (
                        <span className="source-meta-tag">Năm {chunk.applicable_year}</span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-primary)', lineHeight: 1.58 }}>
                    {chunk.text}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span className="source-meta-tag">
                      <FileText size={11} />
                      <span>{chunk.page_or_section || 'Văn bản'}</span>
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => openDocumentDetail(chunk.document_id)}
                    >
                      <span>Xem chi tiết tài liệu</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* Documents Bento Grid */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 17 }}>Danh mục Văn bản Chính thức ({documents.length})</h2>
          </div>

          <div className="library-docs-grid">
            {documents.map((doc) => (
              <article
                key={doc.document_id}
                className="doc-bento-card"
                onClick={() => openDocumentDetail(doc.document_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDocumentDetail(doc.document_id);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className={`category-tag ${doc.category}`}>
                    {doc.category === 'academic' ? 'Học vụ' : 'Tuyển sinh'}
                  </span>
                  <span className="info-tag tabular-nums">
                    {doc.applicable_year ? `Năm ${doc.applicable_year}` : 'Nhiều năm'} · {doc.version || 'v1.0'}
                  </span>
                </div>

                <h3 style={{ fontSize: 15.5, lineHeight: 1.35 }}>{doc.title}</h3>

                <p className="bento-desc" style={{ flex: 1 }}>
                  {doc.summary || 'Tài liệu chính thức đã được trích xuất và lập chỉ mục phục vụ tra cứu RAG VKU Assist.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)' }}>
                  <span className="source-meta-tag tabular-nums">
                    <Layers size={11} />
                    <span>{doc.chunks_count || 0} đoạn chỉ mục</span>
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAskAboutDocument(doc);
                    }}
                  >
                    <MessageSquare size={12} />
                    <span>Hỏi AI</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Document Detail Reader Modal */}
        {(selectedDocDetail || loadingDetail) && (
          <div className="modal-backdrop" onClick={closeDetail}>
            <div className="modal-card modal-large animate-glass-pop" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-header-info">
                  <span className="page-eyebrow">Chi tiết Văn bản Tri thức</span>
                  <h3>{selectedDocDetail?.document?.title || 'Đang tải tài liệu...'}</h3>
                </div>
                <button type="button" className="modal-close-btn" onClick={closeDetail} aria-label="Đóng">
                  <X size={18} />
                </button>
              </div>

              {loadingDetail ? (
                <div className="modal-body">
                  <p>Đang nạp các đoạn trích từ chỉ mục...</p>
                </div>
              ) : (
                <div className="modal-body">
                  <div className="source-meta-row">
                    <span className={`category-tag ${selectedDocDetail.document.category}`}>
                      {selectedDocDetail.document.category === 'academic' ? 'Học vụ' : 'Tuyển sinh'}
                    </span>
                    <span className="source-meta-tag">
                      Năm: {selectedDocDetail.document.applicable_year || 'Mọi năm'}
                    </span>
                    <span className="source-meta-tag">
                      Phiên bản: {selectedDocDetail.document.version || 'v1.0'}
                    </span>
                    <span className="source-meta-tag">
                      {selectedDocDetail.document.chunks_count || selectedDocDetail.chunks.length} đoạn
                    </span>
                  </div>

                  {selectedDocDetail.document.summary && (
                    <p style={{ fontSize: 13.5, color: 'var(--color-text-primary)' }}>
                      {selectedDocDetail.document.summary}
                    </p>
                  )}

                  {selectedDocDetail.chunks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <strong style={{ fontSize: 12.5 }}>Các đoạn trích tiêu biểu trong chỉ mục:</strong>
                      {selectedDocDetail.chunks.map((c, idx) => (
                        <div key={c.chunk_id || idx} className="inspector-excerpt-box">
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }} className="text-brand">
                            <BookOpen size={11} style={{ display: 'inline', marginRight: 5 }} />
                            {c.page_or_section || `Đoạn #${idx + 1}`}
                          </div>
                          <div>{c.text}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="modal-footer">
                    {selectedDocDetail.document.source_url && (
                      <a
                        href={selectedDocDetail.document.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <ExternalLink size={14} />
                        <span>Mở nguồn gốc VKU</span>
                      </a>
                    )}
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleAskAboutDocument(selectedDocDetail.document)}
                    >
                      <MessageSquare size={14} />
                      <span>Hỏi AI chỉ trong văn bản này</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
