import { useEffect } from 'react';
import { X, Sun, Moon, Monitor, Sparkles, Type } from 'lucide-react';

export function PreferencesModal({ isOpen, onClose, preferences, onUpdatePreferences }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card animate-glass-pop"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pref-title"
      >
        <div className="modal-header">
          <div className="modal-header-info">
            <h3 id="pref-title">Tùy chỉnh Giao diện Apple Liquid Glass</h3>
            <p>Cân chỉnh chủ đề Sáng/Tối, hiệu ứng kính mờ và cỡ chữ đọc văn bản</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Chế độ hiển thị (Theme Mode)</label>
            <div className="apple-segmented-control" style={{ width: '100%', justifyContent: 'space-between' }}>
              {[
                { value: 'light', label: 'Sáng', icon: Sun },
                { value: 'dark', label: 'Tối', icon: Moon },
                { value: 'system', label: 'Hệ thống', icon: Monitor },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    style={{ flex: 1, justifyContent: 'center' }}
                    className={`apple-segment-btn ${preferences.themeMode === opt.value ? 'active' : ''}`}
                    onClick={() => onUpdatePreferences({ themeMode: opt.value })}
                  >
                    <Icon size={14} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>Vật liệu bề mặt (Liquid Glass Material)</label>
            <div className="apple-segmented-control" style={{ width: '100%' }}>
              <button
                type="button"
                style={{ flex: 1, justifyContent: 'center' }}
                className={`apple-segment-btn ${!preferences.reducedGlass ? 'active' : ''}`}
                onClick={() => onUpdatePreferences({ reducedGlass: false })}
              >
                <Sparkles size={14} />
                <span>Liquid Glass (Kính mờ)</span>
              </button>
              <button
                type="button"
                style={{ flex: 1, justifyContent: 'center' }}
                className={`apple-segment-btn ${preferences.reducedGlass ? 'active' : ''}`}
                onClick={() => onUpdatePreferences({ reducedGlass: true })}
              >
                <span>Giảm trong suốt (Tương phản cao)</span>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Cỡ chữ đọc quy chế & chat</label>
            <div className="apple-segmented-control" style={{ width: '100%' }}>
              {[
                { value: 'sm', label: 'Nhỏ (13.5px)' },
                { value: 'md', label: 'Tiêu chuẩn (14.5px)' },
                { value: 'lg', label: 'Lớn (16px)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  style={{ flex: 1, justifyContent: 'center' }}
                  className={`apple-segment-btn ${preferences.fontSize === opt.value ? 'active' : ''}`}
                  onClick={() => onUpdatePreferences({ fontSize: opt.value })}
                >
                  <Type size={13} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '0 22px 18px' }}>
          <button type="button" className="btn-primary" onClick={onClose}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}
