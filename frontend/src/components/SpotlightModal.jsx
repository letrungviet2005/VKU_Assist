import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  MessageSquare,
  BookOpen,
  Calculator,
  Bookmark,
  Database,
  Sun,
  Moon,
  Sparkles,
  ArrowRight,
  X,
} from 'lucide-react';
import { storage } from '../services/storage';
import { INITIAL_DOCUMENTS } from '../services/mockData';

function SpotlightDialog({ onClose, theme, onToggleTheme, isMockMode, setIsMockMode }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, []);

  const items = useMemo(() => {
    const baseCommands = [
      { id: 'nav-home', group: 'Trang', label: 'Tổng quan & Khám phá (Bento Hub)', icon: Home, action: () => navigate('/') },
      { id: 'nav-chat', group: 'Trang', label: 'Trợ lý Hỏi đáp AI', icon: MessageSquare, action: () => navigate('/chat') },
      { id: 'nav-library', group: 'Trang', label: 'Kho Văn bản & Tra cứu Ngữ nghĩa', icon: BookOpen, action: () => navigate('/library') },
      { id: 'nav-tools', group: 'Trang', label: 'Công cụ Học vụ (GPA, Học phí, Tốt nghiệp)', icon: Calculator, action: () => navigate('/tools') },
      { id: 'nav-saved', group: 'Trang', label: 'Đã lưu & Ghi chú Tra cứu', icon: Bookmark, action: () => navigate('/saved') },
      { id: 'nav-admin', group: 'Trang', label: 'Trung tâm Quản trị & Đánh giá RAG', icon: Database, action: () => navigate('/admin') },
      {
        id: 'act-theme',
        group: 'Thao tác nhanh',
        label: theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => onToggleTheme(),
      },
      {
        id: 'act-mode',
        group: 'Thao tác nhanh',
        label: isMockMode ? 'Chuyển sang kết nối Backend thật (:8000)' : 'Chuyển sang chế độ Dữ liệu mẫu',
        icon: Sparkles,
        action: () => setIsMockMode(!isMockMode),
      },
    ];

    const sessions = (storage.getChatSessions() || []).slice(0, 5).map((s) => ({
      id: `sess-${s.id}`,
      group: 'Hội thoại gần đây',
      label: s.title || 'Cuộc trò chuyện',
      icon: MessageSquare,
      action: () => navigate(`/chat/${s.id}`),
    }));

    const docs = (storage.getDocuments() || INITIAL_DOCUMENTS).slice(0, 6).map((d) => ({
      id: `doc-${d.document_id}`,
      group: 'Văn bản quy chế',
      label: d.title,
      icon: BookOpen,
      action: () => navigate(`/library?doc=${encodeURIComponent(d.document_id)}`),
    }));

    const all = [...baseCommands, ...sessions, ...docs];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 10);
    return all.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [query, theme, isMockMode, navigate, onToggleTheme, setIsMockMode]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].action();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [items, selectedIndex, onClose]);

  return (
    <div className="spotlight-backdrop" onClick={onClose}>
      <div
        className="spotlight-modal animate-glass-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Spotlight Tìm nhanh"
      >
        <div className="spotlight-input-row">
          <Search size={18} className="text-brand" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm trang, văn bản VKU, hội thoại hoặc lệnh nhanh..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          {query && (
            <button type="button" className="search-clear-btn" onClick={() => setQuery('')} aria-label="Xóa">
              <X size={15} />
            </button>
          )}
          <kbd className="kbd-shortcut">ESC</kbd>
        </div>

        <div className="spotlight-results">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`spotlight-item ${idx === selectedIndex ? 'selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => {
                  item.action();
                  onClose();
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Icon size={16} className="flex-shrink-0" />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span className="info-tag text-muted">{item.group}</span>
                  <ArrowRight size={13} />
                </span>
              </button>
            );
          })}

          {items.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center' }} className="text-muted">
              Không tìm thấy kết quả cho &ldquo;{query}&rdquo; — nhấn Enter trong Hỏi đáp AI để hỏi trực tiếp.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SpotlightModal({ isOpen, ...props }) {
  if (!isOpen) return null;
  return <SpotlightDialog {...props} />;
}
