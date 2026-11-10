import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Home,
  MessageSquare,
  BookOpen,
  Calculator,
  Bookmark,
  Database,
  Sun,
  Moon,
  PanelLeft,
  LogOut,
  ShieldCheck,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../services/api';

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: Home, end: true },
  { to: '/chat', label: 'Hỏi đáp AI', shortLabel: 'Hỏi đáp', icon: MessageSquare },
  { to: '/library', label: 'Kho văn bản', shortLabel: 'Văn bản', icon: BookOpen },
  { to: '/tools', label: 'Công cụ', shortLabel: 'Công cụ', icon: Calculator },
  { to: '/saved', label: 'Đã lưu', shortLabel: 'Đã lưu', icon: Bookmark },
  { to: '/admin', label: 'Quản trị', shortLabel: 'Quản trị', icon: Database },
];

export function Navbar({
  theme,
  onToggleTheme,
  isMockMode,
  setIsMockMode,
  isSidebarOpen,
  setIsSidebarOpen,
  adminToken,
  onLogout,
  onOpenSpotlight,
  onOpenPreferences,
}) {
  const [serverStatus, setServerStatus] = useState({ type: 'offline', text: 'Chưa kết nối cổng 8000' });
  const [sliderStyle, setSliderStyle] = useState({ width: 0, transform: 'translateX(0px)', opacity: 0 });

  const navTabsRef = useRef(null);
  const tabRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();

  const isChatRoute = location.pathname.startsWith('/chat');
  const isAdminView = location.pathname.startsWith('/admin') && Boolean(adminToken);

  const activeNavIndex = NAV_ITEMS.findIndex((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  // Measure active pill position so Liquid Glass slider glides smoothly between tabs
  useLayoutEffect(() => {
    const updateSlider = () => {
      const idx = activeNavIndex >= 0 ? activeNavIndex : 0;
      const el = tabRefs.current[idx];
      if (el) {
        setSliderStyle({
          width: el.offsetWidth,
          transform: `translateX(${el.offsetLeft}px)`,
          opacity: 1,
        });
      }
    };
    updateSlider();
    window.addEventListener('resize', updateSlider);
    return () => window.removeEventListener('resize', updateSlider);
  }, [activeNavIndex, location.pathname]);

  const checkStatus = async () => {
    const health = await api.checkHealth();
    if (health.status === 'ok') {
      const ready = await api.checkReady();
      if (ready.ok) {
        setServerStatus({
          type: 'online',
          text: `Backend Sẵn sàng (${ready.index_version || 'v-ready'})`,
        });
      } else {
        setServerStatus({
          type: 'partial',
          text: `Backend: ${ready.reason || 'Chưa nạp index'}`,
        });
      }
    } else {
      setServerStatus({
        type: 'offline',
        text: 'Backend: Chưa chạy (Cổng 8000)',
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkStatus, 120);
    const interval = setInterval(checkStatus, 25000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">
          {/* Left Section */}
          <div className="navbar-left">
            {isChatRoute && (
              <button
                id="btn-toggle-sidebar"
                type="button"
                className={`sidebar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title={isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên'}
                aria-label="Bật tắt thanh bên lịch sử"
              >
                <PanelLeft size={17} />
              </button>
            )}

            <NavLink to="/" className="navbar-brand">
              <div className="brand-logo">
                <GraduationCap size={20} />
              </div>
              <div className="brand-info">
                <div className="brand-title">
                  <strong>VKU</strong> Assist
                  {isAdminView && <span className="brand-portal-tag admin">Quản trị</span>}
                </div>
                <div className="brand-subtitle">
                  {isAdminView ? 'Quản lý Chỉ mục & Tri thức' : 'Trợ lý Học vụ & Tuyển sinh Đại học'}
                </div>
              </div>
            </NavLink>
          </div>

          {/* Center Gliding Liquid Pill Navigation */}
          <nav className="navbar-center-nav" aria-label="Điều hướng chính">
            <div className="navbar-tabs" ref={navTabsRef}>
              <div className="nav-pill-slider" style={sliderStyle} aria-hidden="true" />
              {NAV_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                const isAdminTab = item.to === '/admin';
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    ref={(el) => {
                      tabRefs.current[idx] = el;
                    }}
                    className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                    {isAdminTab && adminToken && (
                      <span className="tab-auth-dot" title="Đã đăng nhập quản trị" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Right Actions */}
          <div className="navbar-actions">
            <button
              type="button"
              className="spotlight-trigger-btn"
              onClick={onOpenSpotlight}
              title="Tìm nhanh (Ctrl/Cmd + K)"
              aria-label="Mở tìm kiếm nhanh Spotlight"
            >
              <Search size={14} />
              <span className="spotlight-label">Tìm nhanh</span>
              <kbd className="kbd-shortcut">⌘K</kbd>
            </button>

            <div className="segmented-switch" role="group" aria-label="Chọn nguồn dữ liệu">
              <div className={`segmented-slider ${!isMockMode ? 'right' : ''}`} aria-hidden="true" />
              <button
                type="button"
                id="btn-switch-mock"
                className={`segmented-tab ${isMockMode ? 'active' : ''}`}
                onClick={() => setIsMockMode(true)}
                title="Sử dụng dữ liệu mẫu học vụ & tuyển sinh VKU"
              >
                <span>Mẫu</span>
              </button>
              <button
                type="button"
                id="btn-switch-live"
                className={`segmented-tab ${!isMockMode ? 'active' : ''}`}
                onClick={() => setIsMockMode(false)}
                title={`Kết nối Backend thật cổng 8000 (${serverStatus.text})`}
              >
                <span>Backend</span>
                <span
                  className={`status-dot-mini ${serverStatus.type}`}
                  title={`Trạng thái: ${serverStatus.text}`}
                />
              </button>
            </div>

            {isAdminView && (
              <div className="header-admin-profile">
                <span className="admin-chip">
                  <ShieldCheck size={12} />
                  <span>admin</span>
                </span>
                <button
                  type="button"
                  className="header-logout-btn"
                  onClick={() => {
                    onLogout();
                    navigate('/admin');
                  }}
                  title="Đăng xuất Quản trị"
                >
                  <LogOut size={13} />
                </button>
              </div>
            )}

            <button
              type="button"
              className="action-icon-btn"
              onClick={onOpenPreferences}
              title="Tùy chỉnh hiển thị & Liquid Glass"
              aria-label="Cài đặt hiển thị"
            >
              <SlidersHorizontal size={16} />
            </button>

            <button
              id="btn-theme-toggle"
              type="button"
              className="action-icon-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
              aria-label="Đổi giao diện Sáng/Tối"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating iOS Bottom Tab Bar */}
      <nav className="mobile-bottom-dock" aria-label="Điều hướng di động">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `mobile-dock-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
