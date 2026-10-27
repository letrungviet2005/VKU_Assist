import { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Database, 
  MessageSquare, 
  Sun, 
  Moon, 
  PanelLeft,
  LogOut,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import { api } from '../services/api';

/**
 * VKU ASSIST - NAVIGATION HEADER COMPONENT
 * Người thực hiện: Thanh Vương
 * 
 * Tính năng chính:
 * 1. Logo nhận diện thương hiệu VKU và nút bật/tắt Sidebar điều khiển học vụ
 * 2. Bộ điều khiển phân đoạn hai chiều (Segmented Switch) cho phép chuyển tức thì:
 *    [ Dữ liệu mẫu (VKU Mock) | Backend thật (Port 8000) ]
 * 3. Tự động nhận diện phiên Quản trị viên:
 *    - Khi chưa đăng nhập: Hiển thị các tab công cộng Tra cứu & Hỏi đáp, Quản trị Kho văn bản
 *    - Khi đã đăng nhập: Hiển thị giao diện Admin chuyên dụng ("Khu vực Quản trị", nút quay lại tra cứu, huy hiệu Admin, nút Đăng xuất)
 * 4. Nút chuyển đổi nhanh chế độ Sáng / Tối (Light / Dark theme)
 */

export function Navbar({ 
  activeTab, 
  setActiveTab, 
  theme, 
  setTheme, 
  isMockMode, 
  setIsMockMode,
  isSidebarOpen,
  setIsSidebarOpen,
  adminToken,
  onLogout
}) {
  const [serverStatus, setServerStatus] = useState({ type: 'offline', text: 'Chưa kết nối cổng 8000' });

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
    const timer = setTimeout(checkStatus, 100);
    const interval = setInterval(checkStatus, 25000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const isAdminView = activeTab === 'admin' && adminToken;

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Left Section */}
        <div className="navbar-left">
          {activeTab === 'chat' && (
            <button
              id="btn-toggle-sidebar"
              className={`sidebar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? 'Thu gọn thanh bên' : 'Mở rộng thanh bên'}
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={18} />
            </button>
          )}

          <div className="navbar-brand" onClick={() => setActiveTab('chat')}>
            <div className="brand-logo">
              <GraduationCap size={22} className="logo-icon" />
            </div>
            <div className="brand-info">
              <div className="brand-title">
                <strong>VKU</strong> Assist
                {isAdminView ? (
                  <span className="brand-portal-tag admin">Khu vực Quản trị</span>
                ) : (
                  <span className="brand-portal-tag">Cổng thông tin</span>
                )}
              </div>
              <div className="brand-subtitle">
                {isAdminView ? 'Hệ thống Quản lý Chỉ mục & Kho tài liệu' : 'Trợ lý Học vụ & Tuyển sinh Đại học'}
              </div>
            </div>
          </div>
        </div>

        {/* Center Section: Navigation */}
        <nav className="navbar-center-nav">
          {isAdminView ? (
            <button
              type="button"
              className="back-to-chat-btn"
              onClick={() => setActiveTab('chat')}
              title="Quay lại giao diện người dùng tra cứu"
            >
              <ArrowLeft size={15} />
              <span>Quay lại Màn hình Tra cứu</span>
            </button>
          ) : (
            <div className="navbar-tabs">
              <button
                id="tab-chat"
                className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <MessageSquare size={16} />
                <span>Tra cứu & Hỏi đáp</span>
              </button>
              <button
                id="tab-admin"
                className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <Database size={16} />
                <span>Quản trị Kho văn bản</span>
                {adminToken && <span className="tab-auth-dot" title="Đã đăng nhập quản trị" />}
              </button>
            </div>
          )}
        </nav>

        {/* Right Section: Seamless Segmented Switch & Actions */}
        <div className="navbar-actions">
          {/* Segmented Mode Switch: Click qua lại 1 chạm, không bị kẹt hay giật */}
          <div className="segmented-switch" role="group" aria-label="Chọn nguồn dữ liệu">
            <button
              type="button"
              id="btn-switch-mock"
              className={`segmented-tab ${isMockMode ? 'active' : ''}`}
              onClick={() => setIsMockMode(true)}
              title="Sử dụng dữ liệu mẫu học vụ & tuyển sinh VKU"
            >
              <span>Dữ liệu mẫu</span>
            </button>
            <button
              type="button"
              id="btn-switch-live"
              className={`segmented-tab ${!isMockMode ? 'active' : ''}`}
              onClick={() => setIsMockMode(false)}
              title={`Kết nối Backend thật cổng 8000 (${serverStatus.text})`}
            >
              <span>Backend thật</span>
              <span 
                className={`status-dot-mini ${serverStatus.type}`} 
                title={`Trạng thái: ${serverStatus.text}`} 
              />
            </button>
          </div>

          {/* Admin User Badge & Logout in Header */}
          {isAdminView && (
            <div className="header-admin-profile">
              <span className="admin-chip">
                <ShieldCheck size={13} />
                <span>admin</span>
              </span>
              <button
                type="button"
                className="header-logout-btn"
                onClick={onLogout}
                title="Đăng xuất khỏi Quản trị"
              >
                <LogOut size={14} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}

          {/* Theme Toggle */}
          <button
            id="btn-theme-toggle"
            className="action-icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
