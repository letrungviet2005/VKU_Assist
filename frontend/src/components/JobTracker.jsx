import { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { storage } from '../services/storage';

export function JobTracker() {
  const [jobs, setJobs] = useState(() => storage.getJobs());

  const refreshJobs = () => {
    setJobs(storage.getJobs());
  };

  useEffect(() => {
    const timer = setInterval(refreshJobs, 3000);
    return () => clearInterval(timer);
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="job-tracker-card">
      <div className="job-tracker-header">
        <div className="job-tracker-title">
          <Activity size={16} className="text-cyan animate-pulse" />
          <span>Tiến trình xử lý chỉ mục nền (Background Worker Jobs)</span>
        </div>
        <button 
          type="button" 
          className="job-refresh-btn" 
          onClick={refreshJobs} 
          title="Làm mới tiến trình"
        >
          <RefreshCw size={13} />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="job-list">
        {jobs.slice(0, 4).map((job) => (
          <div key={job.job_id} className={`job-item ${job.status}`}>
            <div className="job-main-row">
              <div className="job-id-col">
                <span className="job-badge">{job.job_id}</span>
                <span className="job-doc-name">{job.title}</span>
              </div>
              <div className="job-status-col">
                {job.status === 'processing' && (
                  <span className="job-status-pill processing">
                    <Clock size={12} className="spin" />
                    <span>Đang trích xuất & tạo vector...</span>
                  </span>
                )}
                {job.status === 'completed' && (
                  <span className="job-status-pill completed">
                    <CheckCircle size={12} />
                    <span>Đã công bố ({job.index_version || 'v-latest'})</span>
                  </span>
                )}
                {job.status === 'failed' && (
                  <span className="job-status-pill failed">
                    <AlertTriangle size={12} />
                    <span>Lỗi xử lý</span>
                  </span>
                )}
              </div>
            </div>

            {job.status === 'processing' && (
              <div className="job-progress-bar-bg">
                <div className="job-progress-bar-fill indeterminate"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
