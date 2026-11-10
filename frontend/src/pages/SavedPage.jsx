import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Trash2, Download, MessageSquare, Copy, Check, Tag } from 'lucide-react';
import { storage } from '../services/storage';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

const TAG_OPTIONS = ['Tất cả', 'Học bổng', 'Học vụ', 'Tuyển sinh', 'Học phí', 'Tốt nghiệp'];

export function SavedPage() {
  const [savedItems, setSavedItems] = useState(() => storage.getSavedItems());
  const [selectedTag, setSelectedTag] = useState('Tất cả');
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  const updateList = (next) => {
    setSavedItems(next);
    storage.saveSavedItems(next);
  };

  const handleDelete = (id) => {
    updateList(savedItems.filter((item) => item.id !== id));
  };

  const handleTagChange = (id, tag) => {
    updateList(savedItems.map((item) => (item.id === id ? { ...item, tag } : item)));
  };

  const handleNoteChange = (id, note) => {
    updateList(savedItems.map((item) => (item.id === id ? { ...item, note } : item)));
  };

  const handleCopy = (item) => {
    navigator.clipboard.writeText(item.content || '');
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportMarkdown = () => {
    if (savedItems.length === 0) return;
    let md = `# SỔ TAY TRA CỨU HỌC VỤ ĐÃ LƯU — VKU ASSIST\n\n`;
    savedItems.forEach((item, idx) => {
      md += `## ${idx + 1}. [${item.tag || 'Ghi chú'}] ${item.title || 'Câu trả lời VKU Assist'}\n\n`;
      if (item.note) md += `> **Ghi chú cá nhân:** ${item.note}\n\n`;
      md += `${item.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vku_assist_saved_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filtered = savedItems.filter((item) => selectedTag === 'Tất cả' || item.tag === selectedTag);

  return (
    <div className="page-scroll-area">
      <div className="page-container animate-fade-in">
        <header className="page-header-apple">
          <div>
            <div className="page-eyebrow">Personal Knowledge Bookmarks</div>
            <h1>Đã lưu & Ghi chú Tra cứu</h1>
            <p className="page-subtitle">
              Lưu giữ các câu trả lời quy chế quan trọng kèm nguồn trích dẫn để xem lại nhanh hoặc xuất thành sổ tay học tập.
            </p>
          </div>
          {savedItems.length > 0 && (
            <button type="button" className="btn-primary" onClick={handleExportMarkdown}>
              <Download size={15} />
              <span>Xuất Sổ tay (.md)</span>
            </button>
          )}
        </header>

        <div className="apple-segmented-control" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`apple-segment-btn ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="bento-card" style={{ alignItems: 'center', textAlign: 'center', padding: 48 }}>
            <Bookmark size={36} className="text-brand" />
            <h3>Chưa có nội dung nào được lưu</h3>
            <p className="bento-desc" style={{ maxWidth: 460 }}>
              Trong màn hình Hỏi đáp AI, hãy bấm nút <strong>Lưu</strong> bên dưới bất kỳ câu trả lời nào để lưu lại thông tin quy chế và nguồn trích dẫn.
            </p>
            <button type="button" className="btn-primary" onClick={() => navigate('/chat')}>
              <MessageSquare size={15} />
              <span>Đi tới Hỏi đáp AI</span>
            </button>
          </div>
        ) : (
          <div className="saved-cards-grid">
            {filtered.map((item) => (
              <article key={item.id} className="saved-item-card animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={13} className="text-brand" />
                    <select
                      value={item.tag || 'Học vụ'}
                      onChange={(e) => handleTagChange(item.id, e.target.value)}
                      style={{ padding: '2px 8px', fontSize: 11.5, borderRadius: 999 }}
                      aria-label="Chọn nhãn phân loại"
                    >
                      {TAG_OPTIONS.filter((t) => t !== 'Tất cả').map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" className="action-btn" onClick={() => handleCopy(item)} aria-label="Sao chép">
                      {copiedId === item.id ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
                    </button>
                    <button
                      type="button"
                      className="table-action-btn delete"
                      onClick={() => handleDelete(item.id)}
                      aria-label="Xóa mục đã lưu"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <MarkdownRenderer content={item.content} />
                </div>

                {item.sources && item.sources.length > 0 && (
                  <div className="source-meta-row">
                    {item.sources.map((s, idx) => (
                      <span key={idx} className="source-meta-tag">
                        [{s.source_id}] {s.title}
                      </span>
                    ))}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Thêm ghi chú cá nhân của bạn..."
                  value={item.note || ''}
                  onChange={(e) => handleNoteChange(item.id, e.target.value)}
                  style={{ fontSize: 12.5, padding: '7px 10px' }}
                  aria-label="Ghi chú cá nhân"
                />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
