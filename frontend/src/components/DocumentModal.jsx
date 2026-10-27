import { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export function DocumentModal({ onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('academic');
  const [sourceUrl, setSourceUrl] = useState('');
  const [applicableYear, setApplicableYear] = useState('2026');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await api.uploadDocument({
        title: title.trim(),
        category,
        source_url: sourceUrl.trim(),
        applicable_year: applicableYear,
        issue_date: issueDate,
        file,
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err) {
      alert('Lỗi tải tài liệu: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-large animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-info">
            <h3>Thêm tài liệu mới vào Kho tri thức</h3>
            <p>Tài liệu sẽ được worker phân đoạn và tạo vector nhúng vào chỉ mục FAISS</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="modal-success-state animate-fade-in">
            <CheckCircle2 size={48} className="text-emerald" />
            <h4>Đã tiếp nhận tài liệu thành công!</h4>
            <p>Hệ thống đang tiến hành bóc tách nội dung và cập nhật phiên bản chỉ mục nền.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            {/* File drop zone */}
            <div className="file-drop-zone">
              <input
                id="doc-file-input"
                type="file"
                accept=".pdf,.txt,.md,.docx"
                onChange={handleFileChange}
                className="hidden-file-input"
              />
              <label htmlFor="doc-file-input" className="file-drop-label">
                <UploadCloud size={36} className="text-brand" />
                <span className="drop-title">
                  {file ? file.name : 'Chọn file tài liệu (.PDF, .TXT, .MD, .DOCX)'}
                </span>
                <span className="drop-sub">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB - Nhấp để thay đổi` : 'Kéo thả hoặc nhấp để duyệt file từ máy tính'}
                </span>
              </label>
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="doc-title">Tiêu đề tài liệu chính thức *</label>
                <input
                  id="doc-title"
                  type="text"
                  required
                  placeholder="VD: Quyết định ban hành Quy chế đào tạo tín chỉ VKU..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="doc-category">Danh mục tài liệu *</label>
                <select
                  id="doc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="academic">Học vụ & Đào tạo (academic)</option>
                  <option value="admissions">Tuyển sinh & Học bổng (admissions)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="doc-year">Năm áp dụng</label>
                <input
                  id="doc-year"
                  type="number"
                  placeholder="VD: 2026"
                  min="2020"
                  max="2030"
                  value={applicableYear}
                  onChange={(e) => setApplicableYear(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="doc-date">Ngày ban hành</label>
                <input
                  id="doc-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="doc-url">Đường dẫn nguồn văn bản (URL)</label>
                <input
                  id="doc-url"
                  type="url"
                  placeholder="https://vku.udn.vn/thong-bao-..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn-primary" disabled={submitting || !title.trim()}>
                <FileText size={16} />
                <span>{submitting ? 'Đang tải lên...' : 'Tải lên & Tạo tác vụ chỉ mục'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
