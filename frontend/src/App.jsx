/**
 * VKU ASSIST - ROOT APPLICATION COMPONENT
 * Người thực hiện: Thanh Vương
 * Vai trò: 
 * - Quản lý trạng thái toàn cục: Chủ đề (Dark/Light), Chế độ hoạt động (Dữ liệu mẫu / Backend thật),
 *   Tab hiển thị (Tra cứu / Quản trị), và Token phiên đăng nhập Admin.
 * - Điều phối đồng bộ trạng thái giao diện giữa Navbar và các trang ChatPage / AdminPage.
 */

import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ChatPage } from './pages/ChatPage';
import { AdminPage } from './pages/AdminPage';
import { storage } from './services/storage';
import './App.css';

function App() {
  // Trạng thái Theme (dark / light)
  const [theme, setTheme] = useState(storage.getTheme());
  
  // Tab hiện tại ('chat' cho Tra cứu, 'admin' cho Quản trị kho văn bản)
  const [activeTab, setActiveTab] = useState('chat');
  
  // Chế độ dữ liệu mẫu Mock (true) hoặc kết nối FastAPI Backend thật (false)
  const [isMockMode, setIsMockMode] = useState(storage.getMockMode());
  
  // Trạng thái mở/đóng Sidebar bảng điều khiển RAG
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Token xác thực Quản trị viên (lấy từ LocalStorage để duy trì phiên làm việc)
  const [adminToken, setAdminToken] = useState(() => storage.getAdminToken());

  // Đồng bộ theme vào thuộc tính data-theme của thẻ <html> để CSS biến đổi toàn bộ màu sắc
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.setTheme(theme);
  }, [theme]);

  // Lưu lựa chọn chế độ Dữ liệu mẫu / Backend thật vào LocalStorage
  useEffect(() => {
    storage.setMockMode(isMockMode);
  }, [isMockMode]);

  // Xử lý đăng xuất Quản trị viên: Hủy token và cập nhật giao diện
  const handleLogout = () => {
    storage.setAdminToken(null);
    setAdminToken(null);
  };

  return (
    <div className="app-shell">
      {/* Thanh Header điều hướng trên cùng */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={setTheme}
        isMockMode={isMockMode}
        setIsMockMode={setIsMockMode}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        adminToken={adminToken}
        onLogout={handleLogout}
      />

      {/* Vùng nội dung hiển thị chính */}
      <div className="app-content-body">
        {activeTab === 'chat' ? (
          <ChatPage 
            isMockMode={isMockMode} 
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
          />
        ) : (
          <AdminPage 
            token={adminToken}
            setToken={setAdminToken}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

export default App;
