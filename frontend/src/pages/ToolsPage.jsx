import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  Coins,
  CheckSquare,
  Plus,
  Trash2,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Square,
} from 'lucide-react';
import { storage } from '../services/storage';

const DEFAULT_COURSES = [
  { id: 'c1', name: 'Lập trình hướng đối tượng', credits: 3, grade10: 8.5 },
  { id: 'c2', name: 'Cấu trúc dữ liệu & Giải thuật', credits: 3, grade10: 7.8 },
  { id: 'c3', name: 'Cơ sở dữ liệu', credits: 3, grade10: 8.2 },
  { id: 'c4', name: 'Tiếng Anh chuyên ngành 2', credits: 2, grade10: 7.4 },
];

const DEFAULT_CHECKLIST = [
  { id: 'chk_credits', label: 'Hoàn thành đủ tổng số tín chỉ tích lũy theo chương trình đào tạo', done: true },
  { id: 'chk_gpa', label: 'GPA tích lũy toàn khóa đạt từ 2.00 / 4.00 trở lên (không nợ học phần bắt buộc)', done: true },
  { id: 'chk_english', label: 'Đạt chuẩn ngoại ngữ tiếng Anh (TOEIC ≥ 550 khối Công nghệ hoặc ≥ 600 khối Kinh tế số / IELTS tương đương)', done: false },
  { id: 'chk_it', label: 'Đạt chuẩn kỹ năng ứng dụng CNTT nâng cao (MOS / IC3 hoặc kỳ thi chuẩn CNTT VKU)', done: false },
  { id: 'chk_gdqp', label: 'Hoàn thành chứng chỉ Giáo dục Quốc phòng - An ninh & Giáo dục thể chất', done: true },
];

function convert10To4(score10) {
  const s = Number(score10);
  if (s >= 8.5) return { gpa4: 4.0, letter: 'A' };
  if (s >= 8.0) return { gpa4: 3.5, letter: 'B+' };
  if (s >= 7.0) return { gpa4: 3.0, letter: 'B' };
  if (s >= 6.5) return { gpa4: 2.5, letter: 'C+' };
  if (s >= 5.5) return { gpa4: 2.0, letter: 'C' };
  if (s >= 5.0) return { gpa4: 1.5, letter: 'D+' };
  if (s >= 4.0) return { gpa4: 1.0, letter: 'D' };
  return { gpa4: 0.0, letter: 'F' };
}

export function ToolsPage() {
  const [activeTool, setActiveTool] = useState('gpa');
  const navigate = useNavigate();

  const [courses, setCourses] = useState(() => storage.getGpaCourses() || DEFAULT_COURSES);
  const [studentYear, setStudentYear] = useState('2');
  const [priorCredits, setPriorCredits] = useState('32');
  const [priorGpa, setPriorGpa] = useState('3.10');

  const [programType, setProgramType] = useState('standard');
  const [regCredits, setRegCredits] = useState('18');

  const [majorGroup, setMajorGroup] = useState('tech');
  const [checklist, setChecklist] = useState(() => storage.getGraduationChecklist() || DEFAULT_CHECKLIST);

  const updateCourses = (next) => {
    setCourses(next);
    storage.saveGpaCourses(next);
  };

  const gpaResult = useMemo(() => {
    let semCredits = 0;
    let semPoints = 0;
    let failedCredits = 0;
    courses.forEach((c) => {
      const cr = Math.max(0, Number(c.credits) || 0);
      const { gpa4 } = convert10To4(c.grade10);
      semCredits += cr;
      semPoints += cr * gpa4;
      if (gpa4 === 0) failedCredits += cr;
    });
    const semGpa = semCredits > 0 ? semPoints / semCredits : 0;

    const pCr = Math.max(0, Number(priorCredits) || 0);
    const pGpa = Math.min(4, Math.max(0, Number(priorGpa) || 0));
    const totalCr = semCredits + pCr;
    const cumGpa = totalCr > 0 ? (semPoints + pCr * pGpa) / totalCr : semGpa;

    const minCumThresholds = { '1': 1.2, '2': 1.4, '3': 1.6, '4': 1.8 };
    const warningThreshold = minCumThresholds[studentYear] || 1.4;
    const isWarning = semGpa < 1.2 || cumGpa < warningThreshold || failedCredits > 24;

    let standing = 'Trung bình';
    if (cumGpa >= 3.6) standing = 'Xuất sắc';
    else if (cumGpa >= 3.2) standing = 'Giỏi';
    else if (cumGpa >= 2.5) standing = 'Khá';
    else if (cumGpa < 2.0) standing = 'Yếu / Cần cải thiện';

    return { semCredits, semGpa, cumGpa, failedCredits, isWarning, warningThreshold, standing };
  }, [courses, priorCredits, priorGpa, studentYear]);

  const tuitionEstimate = useMemo(() => {
    const cr = Math.max(0, Number(regCredits) || 0);
    const minRate = programType === 'standard' ? 450000 : 720000;
    const maxRate = programType === 'standard' ? 550000 : 850000;
    return {
      credits: cr,
      minTotal: cr * minRate,
      maxTotal: cr * maxRate,
      minRate,
      maxRate,
    };
  }, [programType, regCredits]);

  const toggleCheckItem = (id) => {
    const next = checklist.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
    setChecklist(next);
    storage.saveGraduationChecklist(next);
  };

  const completedCount = checklist.filter((i) => i.done).length;
  const progressPct = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="page-scroll-area">
      <div className="page-container animate-fade-in">
        <header className="page-header-apple">
          <div>
            <div className="page-eyebrow">VKU Academic Utilities</div>
            <h1>Công cụ Học vụ Tương tác</h1>
            <p className="page-subtitle">
              Mô phỏng quy đổi GPA hệ 4, kiểm tra ngưỡng cảnh báo học vụ, dự toán học phí và theo dõi chuẩn đầu ra tốt nghiệp.
            </p>
          </div>

          <div className="apple-segmented-control" role="tablist">
            <button
              type="button"
              className={`apple-segment-btn ${activeTool === 'gpa' ? 'active' : ''}`}
              onClick={() => setActiveTool('gpa')}
            >
              <Calculator size={14} />
              <span>Tính GPA & Cảnh báo</span>
            </button>
            <button
              type="button"
              className={`apple-segment-btn ${activeTool === 'tuition' ? 'active' : ''}`}
              onClick={() => setActiveTool('tuition')}
            >
              <Coins size={14} />
              <span>Ước tính Học phí</span>
            </button>
            <button
              type="button"
              className={`apple-segment-btn ${activeTool === 'graduation' ? 'active' : ''}`}
              onClick={() => setActiveTool('graduation')}
            >
              <CheckSquare size={14} />
              <span>Chuẩn Tốt nghiệp</span>
            </button>
          </div>
        </header>

        {/* Tool 1: GPA & Academic Warning */}
        {activeTool === 'gpa' && (
          <div className="tools-split-grid">
            <div className="tool-glass-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: 17.5 }}>Bảng điểm học kỳ dự kiến</h2>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    updateCourses([
                      ...courses,
                      { id: 'c_' + Date.now(), name: `Học phần ${courses.length + 1}`, credits: 3, grade10: 7.5 },
                    ])
                  }
                >
                  <Plus size={14} />
                  <span>Thêm học phần</span>
                </button>
              </div>

              <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
                <div className="form-group">
                  <label htmlFor="tool-year">Sinh viên năm thứ</label>
                  <select id="tool-year" value={studentYear} onChange={(e) => setStudentYear(e.target.value)}>
                    <option value="1">Năm 1</option>
                    <option value="2">Năm 2</option>
                    <option value="3">Năm 3</option>
                    <option value="4">Năm 4+</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="tool-prior-cr">Tín chỉ tích lũy trước</label>
                  <input
                    id="tool-prior-cr"
                    type="number"
                    min="0"
                    max="200"
                    value={priorCredits}
                    onChange={(e) => setPriorCredits(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tool-prior-gpa">GPA tích lũy trước (hệ 4)</label>
                  <input
                    id="tool-prior-gpa"
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={priorGpa}
                    onChange={(e) => setPriorGpa(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="gpa-table-header">
                  <span>Tên học phần</span>
                  <span>Tín chỉ</span>
                  <span>Điểm (10) · Chữ</span>
                  <span style={{ textAlign: 'center' }}>Xóa</span>
                </div>

                {courses.map((c) => {
                  const conv = convert10To4(c.grade10);
                  return (
                    <div key={c.id} className="gpa-course-row">
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) =>
                          updateCourses(courses.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
                        }
                        placeholder="Nhập tên học phần..."
                        aria-label="Tên học phần"
                      />
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={c.credits}
                        onChange={(e) =>
                          updateCourses(courses.map((x) => (x.id === c.id ? { ...x, credits: e.target.value } : x)))
                        }
                        title="Số tín chỉ"
                        aria-label="Số tín chỉ"
                      />
                      <div className="gpa-grade-cell">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          style={{ width: '100%', minWidth: 74 }}
                          value={c.grade10}
                          onChange={(e) =>
                            updateCourses(courses.map((x) => (x.id === c.id ? { ...x, grade10: e.target.value } : x)))
                          }
                          title="Điểm hệ 10"
                          aria-label="Điểm hệ 10"
                        />
                        <span className="gpa-letter-pill" title={`Quy đổi: ${conv.gpa4.toFixed(1)}`}>
                          {conv.letter}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="table-action-btn delete"
                        style={{ width: 38, height: 38 }}
                        onClick={() => updateCourses(courses.filter((x) => x.id !== c.id))}
                        aria-label="Xóa học phần"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="tool-glass-card">
              <h2 style={{ fontSize: 17.5 }}>Kết quả & Đánh giá Học vụ</h2>

              <div className="result-highlight-ring">
                <span style={{ fontSize: 12, fontWeight: 600 }} className="text-muted">
                  GPA TÍCH LŨY DỰ KIẾN (THANG 4)
                </span>
                <div className="result-big-number tabular-nums">{gpaResult.cumGpa.toFixed(2)}</div>
                <span style={{ fontSize: 13.5 }}>
                  Xếp loại học lực: <strong>{gpaResult.standing}</strong>
                </span>
              </div>

              <div className="bento-metrics-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="bento-mini-stat" style={{ padding: '14px 16px' }}>
                  <strong className="tabular-nums">{gpaResult.semGpa.toFixed(2)}</strong>
                  <span>GPA Học kỳ ({gpaResult.semCredits} TC)</span>
                </div>
                <div className="bento-mini-stat" style={{ padding: '14px 16px' }}>
                  <strong className="tabular-nums">{gpaResult.warningThreshold.toFixed(2)}</strong>
                  <span>Ngưỡng tích lũy Năm {studentYear}</span>
                </div>
              </div>

              {gpaResult.isWarning ? (
                <div className="chat-error-banner">
                  <AlertTriangle size={20} className="text-danger flex-shrink-0" />
                  <div className="error-text-col">
                    <h4>Cảnh báo nguy cơ xử lý học vụ</h4>
                    <p>Điểm TB học kỳ dưới 1.20 hoặc tích lũy dưới ngưỡng {gpaResult.warningThreshold.toFixed(2)}.</p>
                  </div>
                </div>
              ) : (
                <div className="login-hint-box" style={{ background: 'var(--color-status-success-bg)', borderColor: 'var(--color-status-success-border)', padding: '12px 14px' }}>
                  <CheckCircle2 size={16} className="text-emerald flex-shrink-0" />
                  <span>Đạt trạng thái an toàn theo khung cảnh báo học vụ tham khảo.</span>
                </div>
              )}

              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/chat?q=${encodeURIComponent('Điều kiện bị cảnh báo học vụ và thôi học?')}`)}
              >
                <MessageSquare size={15} />
                <span>Hỏi AI quy chế cảnh báo học vụ</span>
              </button>
            </div>
          </div>
        )}

        {/* Tool 2: Tuition Estimator */}
        {activeTool === 'tuition' && (
          <div className="tools-split-grid">
            <div className="tool-glass-card">
              <h2 style={{ fontSize: 17.5 }}>Thông số ước tính học phí kỳ</h2>
              <div className="form-group" style={{ gap: 10 }}>
                <label>Chương trình đào tạo</label>
                <div className="apple-segmented-control" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`apple-segment-btn ${programType === 'standard' ? 'active' : ''}`}
                    onClick={() => setProgramType('standard')}
                  >
                    Đại trà (CNTT, ATTT, Marketing số...)
                  </button>
                  <button
                    type="button"
                    className={`apple-segment-btn ${programType === 'clc' ? 'active' : ''}`}
                    onClick={() => setProgramType('clc')}
                  >
                    Chất lượng cao / Song ngữ Anh - Hàn
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ gap: 8 }}>
                <label htmlFor="reg-credits" style={{ fontSize: 13.5 }}>
                  Số tín chỉ dự kiến đăng ký: <strong className="text-brand">{tuitionEstimate.credits} tín chỉ</strong>
                </label>
                <input
                  id="reg-credits"
                  className="apple-range-slider"
                  type="range"
                  min="6"
                  max="28"
                  value={regCredits}
                  onChange={(e) => setRegCredits(e.target.value)}
                />
              </div>

              <p className="bento-desc">
                * Đơn giá tham khảo từ mức thu học phí 2025–2026 (Đại trà ~450.000đ–550.000đ/tín chỉ). Luôn đối chiếu thông báo thu học phí chính thức theo từng học kỳ trên cổng Đào tạo VKU.
              </p>
            </div>

            <div className="tool-glass-card">
              <h2 style={{ fontSize: 17.5 }}>Dự toán Học phí Học kỳ</h2>
              <div className="result-highlight-ring">
                <span style={{ fontSize: 12, fontWeight: 600 }} className="text-muted">KHOẢNG HỌC PHÍ DỰ KIẾN</span>
                <div className="result-big-number tabular-nums" style={{ fontSize: 26 }}>
                  {tuitionEstimate.minTotal.toLocaleString('vi-VN')}đ – {tuitionEstimate.maxTotal.toLocaleString('vi-VN')}đ
                </div>
                <span style={{ fontSize: 13 }}>
                  Đơn giá tham khảo: {tuitionEstimate.minRate.toLocaleString('vi-VN')}đ – {tuitionEstimate.maxRate.toLocaleString('vi-VN')}đ / tín chỉ
                </span>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/chat?q=${encodeURIComponent('Học phí và chính sách học bổng năm 2026?')}`)}
              >
                <MessageSquare size={15} />
                <span>Xem thông báo học phí qua AI</span>
              </button>
            </div>
          </div>
        )}

        {/* Tool 3: Graduation Checklist */}
        {activeTool === 'graduation' && (
          <div className="tools-split-grid">
            <div className="tool-glass-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: 17.5 }}>Checklist Điều kiện Tốt nghiệp</h2>
                <div className="apple-segmented-control">
                  {[
                    { id: 'tech', label: 'Khối Công nghệ' },
                    { id: 'economy', label: 'Kinh tế số' },
                    { id: 'bilingual', label: 'Song ngữ Hàn' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`apple-segment-btn ${majorGroup === g.id ? 'active' : ''}`}
                      onClick={() => setMajorGroup(g.id)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="login-hint-box" style={{ padding: '12px 14px' }}>
                <span>
                  Chuẩn ngoại ngữ áp dụng:{' '}
                  <strong>
                    {majorGroup === 'tech'
                      ? 'TOEIC ≥ 550 hoặc IELTS ≥ 5.0'
                      : majorGroup === 'economy'
                        ? 'TOEIC ≥ 600 hoặc IELTS ≥ 5.5'
                        : 'TOEIC ≥ 550 + TOPIK Level 3 trở lên'}
                  </strong>
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className={`checklist-item-row ${item.done ? 'checked' : ''}`}
                    onClick={() => toggleCheckItem(item.id)}
                    role="checkbox"
                    aria-checked={item.done}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCheckItem(item.id);
                      }
                    }}
                  >
                    {item.done ? (
                      <CheckCircle2 size={19} className="text-emerald flex-shrink-0" />
                    ) : (
                      <Square size={19} className="text-muted flex-shrink-0" />
                    )}
                    <span style={{ fontSize: 13.5, color: 'var(--color-text-primary)', lineHeight: 1.48 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="tool-glass-card">
              <h2 style={{ fontSize: 17.5 }}>Tiến độ Tốt nghiệp</h2>
              <div className="result-highlight-ring">
                <span style={{ fontSize: 12, fontWeight: 600 }} className="text-muted">MỨC ĐỘ HOÀN THÀNH</span>
                <div className="result-big-number tabular-nums">{progressPct}%</div>
                <span>Đã hoàn thành {completedCount} / {checklist.length} tiêu chí</span>
              </div>

              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/chat?q=${encodeURIComponent('Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp')}`)}
              >
                <MessageSquare size={15} />
                <span>Hỏi AI chi tiết chuẩn đầu ra</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
