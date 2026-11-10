import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Search,
  Filter,
  ExternalLink,
  Lock,
  ShieldCheck,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Download,
  X,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { DocumentModal } from '../components/DocumentModal';
import { JobTracker } from '../components/JobTracker';
import { api } from '../services/api';
import { PILOT_EVAL_SUMMARY } from '../services/mockData';

export function AdminPage({ token, setToken, isMockMode = true }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('vku2026');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('documents'); // 'overview' | 'documents' | 'feedback'

  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState('all');

  const refreshData = useCallback(async () => {
    try {
      const [docs, feedbacks] = await Promise.all([
        api.getDocuments(isMockMode),
        api.getFeedback(),
      ]);
      setDocuments(docs || []);
      setFeedbackList(feedbacks || []);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu quản trị:', err);
    }
  }, [isMockMode]);

  useEffect(() => {
    let isMounted = true;
    if (token) {
      Promise.all([api.getDocuments(isMockMode), api.getFeedback()])
        .then(([docs, feedbacks]) => {
          if (isMounted) {
            setDocuments(docs || []);
            setFeedbackList(feedbacks || []);
          }
        })
        .catch((err) => console.error('Lỗi nạp dữ liệu quản trị:', err));
    }
    return () => {
      isMounted = false;
    };
  }, [token, isMockMode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await api.adminLogin(username.trim(), password.trim(), isMockMode);
      setToken(res.access_token);
    } catch (err) {
      setLoginError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDeleteDocument = async (docId, title) => {
    if (window.confirm(`Xác nhận xóa tài liệu "${title}" khỏi hệ thống RAG?`)) {
      await api.deleteDocument(docId, isMockMode);
      refreshData();
    }
  };

  const handleExportFeedback = () => {
    if (feedbackList.length === 0) {
      alert('Chưa có dữ liệu phản hồi để xuất.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(feedbackList, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vku_assist_feedback_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = (doc.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredFeedbacks = feedbackList.filter((fb) => {
    const matchesRating = feedbackRatingFilter === 'all' || fb.rating === feedbackRatingFilter;
    const matchesText =
      !feedbackSearch ||
      (fb.comment && fb.comment.toLowerCase().includes(feedbackSearch.toLowerCase())) ||
      (fb.message_id && fb.message_id.includes(feedbackSearch));
    return matchesRating && matchesText;
  });

  const totalDocs = documents.length;
  const readyDocs = documents.filter((d) => d.status === 'ready').length;
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunks_count || 0), 0);
  const academicDocs = documents.filter((d) => d.category === 'academic').length;
  const admissionsDocs = documents.filter((d) => d.category === 'admissions').length;
  const helpfulCount = feedbackList.filter((f) => f.rating === 'helpful').length;
  const satisfactionRate = feedbackList.length > 0 ? Math.round((helpfulCount / feedbackList.length) * 100) : 100;

  if (!token) {
    return (
      <div className="admin-login-wrapper animate-fade-in">
        <div className="admin-login-card">
          <div className="login-header">
            <div className="login-icon-badge">
              <Lock size={24} />
            </div>
            <h2>Đăng nhập Quản trị viên VKU</h2>
            <p>Khu vực quản lý văn bản quy chế, cập nhật đề án tuyển sinh và giám sát chỉ mục RAG</p>
          </div>

          {loginError && (
            <div className="login-error-banner animate-fade-in" role="alert">
              <AlertTriangle size={15} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="admin-username">Tên người dùng</label>
              <input
                id="admin-username"
                type="text"
                required
                placeholder="Nhập tên đăng nhập quản trị..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-password">Mật khẩu</label>
              <input
                id="admin-password"
                type="password"
                required
                placeholder="Nhập mật khẩu quản trị..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="login-hint-box">
              <ShieldCheck size={14} className="text-brand flex-shrink-0" />
              <span>Tài khoản thử nghiệm: <strong>admin</strong> / <strong>vku2026</strong> ({isMockMode ? 'Mock' : 'Backend JWT'})</span>
            </div>

            <button
              type="submit"
              id="btn-admin-login"
              className="btn-primary full-width"
              disabled={isLoggingIn}
            >
              <span>{isLoggingIn ? 'Đang xác thực...' : 'Đăng nhập Quản trị'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container animate-fade-in">
      <div className="admin-top-bar">
        <div className="admin-top-info">
          <h2>Bảng điều khiển Kho văn bản & Đánh giá RAG</h2>
          <p>Quản lý tài liệu quy chế, tiến trình vector hóa nền và dữ liệu phản hồi chất lượng</p>
        </div>
      </div>

      {/* Stats Bento Cards */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper blue"><FileText size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{totalDocs}</span>
            <span className="stat-label">Tổng số tài liệu</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green"><CheckCircle2 size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{readyDocs}</span>
            <span className="stat-label">Đã nạp vào chỉ mục</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper cyan"><Database size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{totalChunks}</span>
            <span className="stat-label">Tổng số đoạn (Chunks)</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper amber"><TrendingUp size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{satisfactionRate}%</span>
            <span className="stat-label">Hài lòng ({helpfulCount}/{feedbackList.length})</span>
          </div>
        </div>
      </div>

      <JobTracker isMockMode={isMockMode} />

      {/* Segmented Sub-tabs */}
      <div className="admin-tabs-row">
        <div className="subtabs">
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <BarChart3 size={15} />
            <span>Phân tích & Pilot Benchmark</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={15} />
            <span>Danh mục Tài liệu ({documents.length})</span>
          </button>
          <button
            type="button"
            className={`subtab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            <MessageSquare size={15} />
            <span>Phản hồi ({feedbackList.length})</span>
          </button>
        </div>

        {activeTab === 'documents' && (
          <button
            type="button"
            id="btn-upload-doc"
            className="btn-primary"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Plus size={15} />
            <span>Thêm tài liệu mới</span>
          </button>
        )}

        {activeTab === 'feedback' && (
          <button type="button" className="btn-secondary" onClick={handleExportFeedback}>
            <Download size={14} />
            <span>Xuất JSON phản hồi</span>
          </button>
        )}
      </div>

      {activeTab === 'overview' && (
        <div className="bento-grid">
          <div className="bento-card bento-span-6">
            <h3 className="bento-title">Phân bố Danh mục Kho Tri thức</h3>
            <p className="bento-desc">Tỷ trọng văn bản Học vụ (Academic) so với Tuyển sinh (Admissions)</p>
            <div className="bento-metrics-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="bento-mini-stat">
                <strong className="tabular-nums">{academicDocs}</strong>
                <span>Học vụ & Đào tạo</span>
              </div>
              <div className="bento-mini-stat">
                <strong className="tabular-nums">{admissionsDocs}</strong>
                <span>Tuyển sinh & Học bổng</span>
              </div>
            </div>
          </div>

          <div className="bento-card bento-span-6">
            <h3 className="bento-title">{PILOT_EVAL_SUMMARY.datasetName}</h3>
            <p className="bento-desc">
              Bộ đánh giá pilot gồm {PILOT_EVAL_SUMMARY.totalQuestions} câu hỏi trên {PILOT_EVAL_SUMMARY.indexedDocuments} bài gốc ({PILOT_EVAL_SUMMARY.indexedChunks} đoạn trích).
            </p>
            <div className="bento-action-list">
              {PILOT_EVAL_SUMMARY.breakdown.map((b, idx) => (
                <div key={idx} className="bento-row-btn" style={{ cursor: 'default' }}>
                  <span>{b.group}</span>
                  <span className="source-meta-tag">{b.count} câu · {b.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <>
          <div className="table-controls-bar">
            <div className="search-input-box">
              <Search size={15} className="text-muted" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu theo tiêu đề..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm tài liệu"
              />
              {searchQuery && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Xóa">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="table-filters">
              <div className="filter-group">
                <Filter size={14} className="text-muted" />
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Danh mục">
                  <option value="all">Tất cả danh mục</option>
                  <option value="academic">Học vụ (academic)</option>
                  <option value="admissions">Tuyển sinh (admissions)</option>
                </select>
              </div>
              <div className="filter-group">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Trạng thái">
                  <option value="all">Mọi trạng thái</option>
                  <option value="ready">Sẵn sàng (Ready)</option>
                  <option value="processing">Đang xử lý</option>
                </select>
              </div>
            </div>
          </div>

          <div className="table-summary-info">
            <span>Hiển thị <strong>{filteredDocs.length}</strong> / <strong>{documents.length}</strong> tài liệu quy chế</span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tên tài liệu / Văn bản</th>
                  <th>Danh mục</th>
                  <th>Năm áp dụng</th>
                  <th>Phiên bản</th>
                  <th>Số đoạn</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => (
                  <tr key={doc.document_id}>
                    <td className="doc-name-cell">
                      <div className="doc-title-row">
                        <FileText size={16} className="text-brand flex-shrink-0" />
                        <span className="doc-title-text" title={doc.title}>{doc.title}</span>
                      </div>
                      <div className="doc-meta-sub">
                        <span>Ban hành: {doc.issue_date || 'N/A'}</span>
                        {doc.source_url && (
                          <a href={doc.source_url} target="_blank" rel="noreferrer" className="doc-url-link">
                            <span>Xem gốc</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`category-tag ${doc.category}`}>
                        {doc.category === 'academic' ? 'Học vụ' : 'Tuyển sinh'}
                      </span>
                    </td>
                    <td>{doc.applicable_year || 'Mọi năm'}</td>
                    <td>{doc.version || 'v1.0'}</td>
                    <td className="tabular-nums">{doc.chunks_count || 0} đoạn</td>
                    <td>
                      {doc.status === 'ready' && (
                        <span className="status-pill-table ready"><CheckCircle2 size={13} /><span>Sẵn sàng</span></span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="status-pill-table processing"><Clock size={13} /><span>Đang xử lý</span></span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="status-pill-table failed"><AlertTriangle size={13} /><span>Lỗi</span></span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-action-btn delete"
                        onClick={() => handleDeleteDocument(doc.document_id, doc.title)}
                        title="Xóa tài liệu"
                        aria-label="Xóa tài liệu"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-table-cell">Không tìm thấy tài liệu phù hợp.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'feedback' && (
        <div className="feedback-list-container">
          <div className="feedback-list-header">
            <div className="feedback-header-info">
              <h3>Danh sách góp ý & Đánh giá từ người dùng</h3>
              <p>Phục vụ tinh chỉnh prompt và đánh giá chất lượng câu trả lời RAG</p>
            </div>
            <div className="feedback-controls-row">
              <div className="search-input-box mini">
                <Search size={14} className="text-muted" />
                <input
                  type="text"
                  placeholder="Lọc góp ý hoặc Message ID..."
                  value={feedbackSearch}
                  onChange={(e) => setFeedbackSearch(e.target.value)}
                />
              </div>
              <div className="filter-group mini">
                <select value={feedbackRatingFilter} onChange={(e) => setFeedbackRatingFilter(e.target.value)}>
                  <option value="all">Tất cả đánh giá</option>
                  <option value="helpful">Hài lòng & Đúng nguồn</option>
                  <option value="not_helpful">Chưa thỏa đáng</option>
                </select>
              </div>
            </div>
          </div>

          <div className="feedback-cards-grid">
            {filteredFeedbacks.map((fb, idx) => (
              <div key={idx} className="feedback-item-card animate-fade-in">
                <div className="feedback-item-top">
                  <span className={`feedback-rating-badge ${fb.rating}`}>
                    {fb.rating === 'helpful' ? (
                      <><ThumbsUp size={13} /><span>Hài lòng</span></>
                    ) : (
                      <><ThumbsDown size={13} /><span>Chưa thỏa đáng</span></>
                    )}
                  </span>
                  <span className="feedback-time">
                    {fb.created_at ? new Date(fb.created_at).toLocaleString('vi-VN') : ''}
                  </span>
                </div>
                <div className="feedback-comment-text">
                  {fb.comment ? `"${fb.comment}"` : <em>(Không có bình luận chi tiết)</em>}
                </div>
                <div className="feedback-msg-id">Message ID: {fb.message_id}</div>
              </div>
            ))}
            {filteredFeedbacks.length === 0 && (
              <div className="empty-feedback-state">
                <MessageSquare size={32} className="text-muted" />
                <p>Chưa có đánh giá phù hợp với bộ lọc.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <DocumentModal
          isMockMode={isMockMode}
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={refreshData}
        />
      )}
    </div>
  );
}
