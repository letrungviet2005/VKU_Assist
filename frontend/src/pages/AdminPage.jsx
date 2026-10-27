import { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  ExternalLink, 
  Lock, 
  LogOut, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from 'lucide-react';
import { DocumentModal } from '../components/DocumentModal';
import { JobTracker } from '../components/JobTracker';
import { api } from '../services/api';
import { storage } from '../services/storage';

export function AdminPage({ token, setToken, onLogout }) {
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
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'feedback'

  const loadData = async () => {
    const docs = await api.getDocuments();
    setDocuments(docs);
    setFeedbackList(storage.getFeedback());
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await api.adminLogin(username.trim(), password.trim());
      setToken(res.access_token);
    } catch (err) {
      setLoginError(err.message || 'Đăng nhập không thành công.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      storage.setAdminToken(null);
      setToken(null);
    }
  };

  const handleDeleteDocument = async (docId, title) => {
    if (window.confirm(`Xác nhận xóa tài liệu "${title}" khỏi hệ thống RAG?`)) {
      await api.deleteDocument(docId);
      loadData();
    }
  };

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate stats
  const totalDocs = documents.length;
  const readyDocs = documents.filter((d) => d.status === 'ready').length;
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunks_count || 0), 0);
  const helpfulCount = feedbackList.filter((f) => f.rating === 'helpful').length;

  if (!token) {
    return (
      <div className="admin-login-wrapper animate-fade-in">
        <div className="login-card">
          <div className="login-icon-box">
            <Lock size={30} className="text-brand" />
          </div>
          <h2>Đăng nhập Quản trị viên</h2>
          <p className="login-sub">
            Khu vực dành cho quản trị viên quản lý kho tài liệu văn bản và kiểm soát chỉ mục RAG của VKU Assist.
          </p>

          {loginError && (
            <div className="login-error-alert animate-shake">
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="admin-username">Tài khoản quản trị</label>
              <input
                id="admin-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-password">Mật khẩu</label>
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="login-demo-hint">
              <span>Tài khoản thử nghiệm: <strong>admin</strong> / Mật khẩu: <strong>vku2026</strong></span>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoggingIn}>
              <ShieldCheck size={18} />
              <span>{isLoggingIn ? 'Đang xác thực...' : 'Đăng nhập Quản trị'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container animate-fade-in">
      {/* Top Banner */}
      <div className="admin-top-bar">
        <div className="admin-top-info">
          <h2>Bảng điều khiển Kho văn bản & Chỉ mục tri thức</h2>
          <p>Quản lý tài liệu quy chế đào tạo, đề án tuyển sinh và giám sát tiến trình vector hóa nền</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <FileText size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalDocs}</span>
            <span className="stat-label">Tổng số tài liệu</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{readyDocs}</span>
            <span className="stat-label">Đã nạp vào chỉ mục</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper cyan">
            <Database size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalChunks}</span>
            <span className="stat-label">Tổng số đoạn vector (Chunks)</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper amber">
            <ThumbsUp size={22} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{helpfulCount} / {feedbackList.length}</span>
            <span className="stat-label">Đánh giá hữu ích từ người dùng</span>
          </div>
        </div>
      </div>

      {/* Background Job Tracker */}
      <JobTracker />

      {/* Tabs & Actions Bar */}
      <div className="admin-tabs-row">
        <div className="subtabs">
          <button
            className={`subtab-btn ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={16} />
            <span>Danh mục Tài liệu ({documents.length})</span>
          </button>
          <button
            className={`subtab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            <MessageSquare size={16} />
            <span>Phản hồi người dùng ({feedbackList.length})</span>
          </button>
        </div>

        {activeTab === 'documents' && (
          <button
            id="btn-upload-doc"
            className="btn-primary"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Plus size={16} />
            <span>Thêm tài liệu mới</span>
          </button>
        )}
      </div>

      {activeTab === 'documents' ? (
        <>
          {/* Filter & Search Bar */}
          <div className="table-controls-bar">
            <div className="search-input-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm kiếm tài liệu theo tiêu đề..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="table-filters">
              <div className="filter-group">
                <Filter size={14} className="filter-icon" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Tất cả danh mục</option>
                  <option value="academic">Học vụ (academic)</option>
                  <option value="admissions">Tuyển sinh (admissions)</option>
                </select>
              </div>

              <div className="filter-group">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Mọi trạng thái</option>
                  <option value="ready">Sẵn sàng (Ready)</option>
                  <option value="processing">Đang xử lý (Processing)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Documents Table */}
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
                        <span>Ban hành: {doc.issue_date}</span>
                        {doc.source_url && (
                          <a href={doc.source_url} target="_blank" rel="noreferrer" className="doc-url-link">
                            <span>Xem văn bản gốc</span>
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
                    <td>
                      <span className="year-cell">{doc.applicable_year || 'Mọi năm'}</span>
                    </td>
                    <td>
                      <span className="version-cell">{doc.version || 'v1.0'}</span>
                    </td>
                    <td>
                      <span className="chunks-cell">{doc.chunks_count || 0} đoạn</span>
                    </td>
                    <td>
                      {doc.status === 'ready' && (
                        <span className="status-pill-table ready">
                          <CheckCircle2 size={13} />
                          <span>Sẵn sàng</span>
                        </span>
                      )}
                      {doc.status === 'processing' && (
                        <span className="status-pill-table processing">
                          <Clock size={13} className="spin" />
                          <span>Đang lập chỉ mục</span>
                        </span>
                      )}
                      {doc.status === 'failed' && (
                        <span className="status-pill-table failed">
                          <AlertTriangle size={13} />
                          <span>Lỗi</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="table-action-btn delete"
                          onClick={() => handleDeleteDocument(doc.document_id, doc.title)}
                          title="Xóa tài liệu"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-table-cell">
                      Không tìm thấy tài liệu phù hợp với điều kiện lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Feedback Review Panel */
        <div className="feedback-list-container">
          <div className="feedback-list-header">
            <h3>Danh sách góp ý & Đánh giá từ sinh viên/người dùng</h3>
            <p>Dữ liệu này dùng để hoàn thiện prompt và đánh giá 60 câu hỏi đối chiếu ở Tuần 3 & Tuần 4</p>
          </div>

          <div className="feedback-cards-grid">
            {feedbackList.map((fb, idx) => (
              <div key={idx} className="feedback-item-card">
                <div className="feedback-item-top">
                  <span className={`feedback-rating-badge ${fb.rating}`}>
                    {fb.rating === 'helpful' ? (
                      <>
                        <ThumbsUp size={13} />
                        <span>Hài lòng & Đúng nguồn</span>
                      </>
                    ) : (
                      <>
                        <ThumbsDown size={13} />
                        <span>Chưa thỏa đáng</span>
                      </>
                    )}
                  </span>
                  <span className="feedback-time">
                    {new Date(fb.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="feedback-comment-text">
                  {fb.comment ? `"${fb.comment}"` : <em>(Người dùng không để lại bình luận chi tiết)</em>}
                </div>
                <div className="feedback-msg-id">
                  <span>Message ID: {fb.message_id}</span>
                </div>
              </div>
            ))}
            {feedbackList.length === 0 && (
              <div className="empty-feedback-state">
                <MessageSquare size={36} className="text-muted" />
                <p>Chưa có lượt đánh giá nào từ người dùng.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <DocumentModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
