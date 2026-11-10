import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  GraduationCap,
  Award,
  BookOpen,
  Calculator,
  MessageSquare,
  Activity,
  ChevronRight,
  Bookmark,
  FileText,
} from 'lucide-react';
import { api } from '../services/api';
import { storage } from '../services/storage';

const QUICK_PROMPTS = [
  '5 phương thức xét tuyển Đại học VKU năm 2026',
  'Học phí và chính sách học bổng năm 2026?',
  'Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp',
  'Điều kiện bị cảnh báo học vụ và thôi học?',
];

export function HomePage({ isMockMode, setIsMockMode }) {
  const [heroPrompt, setHeroPrompt] = useState('');
  const [recentSessions] = useState(() => (storage.getChatSessions() || []).slice(0, 3));
  const [savedCount] = useState(() => (storage.getSavedItems() || []).length);
  const [libraryStats, setLibraryStats] = useState({ total: 5, indexVersion: 'mock-index-v2026.1' });
  const [backendReady, setBackendReady] = useState({ ok: false, label: 'Đang kiểm tra...' });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.getLibraryDocuments({ isMock: isMockMode }).then((res) => {
      if (active && res) {
        setLibraryStats({
          total: res.total ?? (res.documents?.length || 0),
          indexVersion: res.index_version || (isMockMode ? 'mock-index-v2026.1' : 'chưa nạp'),
        });
      }
    });
    api.checkReady().then((ready) => {
      if (!active) return;
      if (ready.ok) {
        setBackendReady({ ok: true, label: 'Sẵn sàng (Cổng 8000)' });
      } else {
        setBackendReady({ ok: false, label: isMockMode ? 'Đang chạy Dữ liệu mẫu' : 'Backend chưa sẵn sàng' });
      }
    });
    return () => {
      active = false;
    };
  }, [isMockMode]);

  const launchChatWithPrompt = (question) => {
    const clean = (question || '').trim();
    if (!clean) {
      navigate('/chat');
      return;
    }
    navigate(`/chat?q=${encodeURIComponent(clean)}`);
  };

  const handleHeroSubmit = (e) => {
    e.preventDefault();
    launchChatWithPrompt(heroPrompt);
  };

  return (
    <div className="page-scroll-area">
      <div className="page-container animate-fade-in">
        {/* Apple Liquid Glass Hero */}
        <section className="home-hero-glass">
          <div className="hero-pill-badge">
            <Sparkles size={14} />
            <span>VKU Assist · Apple Liquid Glass Experience</span>
          </div>

          <h1 className="home-hero-title">
            Tra cứu Học vụ & Tuyển sinh VKU thông minh, dẫn nguồn chính xác
          </h1>

          <p className="home-hero-desc">
            Đặt câu hỏi bằng tiếng Việt tự nhiên, tìm kiếm trực tiếp trong kho văn bản quy chế, hoặc dùng bộ công cụ tính GPA, học phí và điều kiện tốt nghiệp.
          </p>

          <form onSubmit={handleHeroSubmit} className="hero-prompt-bar">
            <input
              type="text"
              placeholder="Hỏi VKU Assist bất kỳ điều gì về quy chế, học phí, học bổng..."
              value={heroPrompt}
              onChange={(e) => setHeroPrompt(e.target.value)}
              aria-label="Hỏi nhanh VKU Assist"
            />
            <button type="submit" className="hero-prompt-submit">
              <span>Hỏi ngay</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="hero-quick-pills">
            {QUICK_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="hero-quick-pill"
                onClick={() => launchChatWithPrompt(q)}
              >
                <span>{q}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Apple Bento Grid */}
        <section className="bento-grid" aria-label="Bảng điều khiển nhanh">
          {/* Tile 1: Recent Conversations & Quick Chat */}
          <div className="bento-card bento-span-8">
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="bento-icon-tile blue">
                  <MessageSquare size={19} />
                </div>
                <div>
                  <h3 className="bento-title">Phiên Hỏi đáp & Tiếp tục Tra cứu</h3>
                  <p className="bento-desc">Mở lại hội thoại gần đây hoặc bắt đầu cuộc trò chuyện đa lượt mới</p>
                </div>
              </div>
              <button type="button" className="btn-primary" onClick={() => navigate('/chat')}>
                <span>Mở Hỏi đáp</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="bento-action-list">
              {recentSessions.length > 0 ? (
                recentSessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="bento-row-btn"
                    onClick={() => navigate(`/chat/${s.id}`)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <MessageSquare size={14} className="text-brand flex-shrink-0" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title || 'Cuộc trò chuyện mới'}
                      </span>
                    </span>
                    <ChevronRight size={15} className="text-muted flex-shrink-0" />
                  </button>
                ))
              ) : (
                <button type="button" className="bento-row-btn" onClick={() => navigate('/chat')}>
                  <span>Chưa có phiên hội thoại nào — Bấm để bắt đầu tra cứu</span>
                  <ChevronRight size={15} className="text-muted" />
                </button>
              )}
            </div>
          </div>

          {/* Tile 2: Live RAG & System Status */}
          <div className="bento-card bento-span-4">
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="bento-icon-tile green">
                  <Activity size={19} />
                </div>
                <div>
                  <h3 className="bento-title">Trạng thái Hệ thống</h3>
                  <p className="bento-desc">{backendReady.label}</p>
                </div>
              </div>
            </div>

            <div className="bento-metrics-row">
              <div className="bento-mini-stat">
                <strong className="tabular-nums">{libraryStats.total}</strong>
                <span>Văn bản</span>
              </div>
              <div className="bento-mini-stat">
                <strong className="tabular-nums">{savedCount}</strong>
                <span>Đã lưu</span>
              </div>
              <div className="bento-mini-stat">
                <strong>{isMockMode ? 'Mẫu' : 'Live'}</strong>
                <span>Chế độ</span>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: 'auto', width: '100%' }}
              onClick={() => setIsMockMode(!isMockMode)}
            >
              <span>{isMockMode ? 'Chuyển sang Backend thật (:8000)' : 'Chuyển sang Dữ liệu mẫu'}</span>
            </button>
          </div>

          {/* Tile 3: Admissions Shortcuts */}
          <div className="bento-card bento-span-4">
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="bento-icon-tile indigo">
                  <GraduationCap size={19} />
                </div>
                <div>
                  <h3 className="bento-title">Tân sinh viên & Tuyển sinh</h3>
                  <p className="bento-desc">Đề án tuyển sinh, học bổng đầu vào & phương thức xét</p>
                </div>
              </div>
            </div>

            <div className="bento-action-list">
              <button
                type="button"
                className="bento-row-btn"
                onClick={() => launchChatWithPrompt('5 phương thức xét tuyển Đại học VKU')}
              >
                <span>5 phương thức xét tuyển 2026</span>
                <ChevronRight size={14} className="text-muted" />
              </button>
              <button
                type="button"
                className="bento-row-btn"
                onClick={() => launchChatWithPrompt('Học bổng Thủ khoa và tài trợ doanh nghiệp Hàn Quốc')}
              >
                <span>Học bổng Thủ khoa & Doanh nghiệp</span>
                <ChevronRight size={14} className="text-muted" />
              </button>
            </div>
          </div>

          {/* Tile 4: Academic Library */}
          <div className="bento-card bento-span-4 interactive" onClick={() => navigate('/library')} role="button" tabIndex={0}>
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="bento-icon-tile blue">
                  <BookOpen size={19} />
                </div>
                <div>
                  <h3 className="bento-title">Kho Văn bản Quy chế</h3>
                  <p className="bento-desc">Tìm kiếm ngữ nghĩa thẳng vào điều khoản & mục lục</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-brand" />
            </div>

            <div className="bento-action-list">
              <div className="bento-row-btn">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} className="text-brand" />
                  <span>Chỉ mục: {String(libraryStats.indexVersion).slice(0, 18)}</span>
                </span>
                <span className="info-tag">Khám phá</span>
              </div>
            </div>
          </div>

          {/* Tile 5: Academic Tools & Saved */}
          <div className="bento-card bento-span-4">
            <div className="bento-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="bento-icon-tile amber">
                  <Calculator size={19} />
                </div>
                <div>
                  <h3 className="bento-title">Tiện ích Sinh viên VKU</h3>
                  <p className="bento-desc">Tính GPA, dự toán học phí & ghi chú đã lưu</p>
                </div>
              </div>
            </div>

            <div className="bento-action-list">
              <button type="button" className="bento-row-btn" onClick={() => navigate('/tools')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Award size={14} className="text-brand" />
                  <span>Tính GPA, Học phí & Chuẩn đầu ra</span>
                </span>
                <ChevronRight size={14} className="text-muted" />
              </button>
              <button type="button" className="bento-row-btn" onClick={() => navigate('/saved')}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Bookmark size={14} className="text-brand" />
                  <span>Ghi chú & Câu trả lời đã lưu ({savedCount})</span>
                </span>
                <ChevronRight size={14} className="text-muted" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
