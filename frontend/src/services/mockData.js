/**
 * High-fidelity mock knowledge base for VKU Assist
 * Used for development, testing error edge-cases, and offline demos.
 */

export const INITIAL_DOCUMENTS = [
  {
    document_id: "doc-vku-admissions-2026",
    title: "Đề án tuyển sinh Đại học chính quy VKU năm 2026",
    category: "admissions",
    source_url: "https://vku.udn.vn/tuyen-sinh/de-an-tuyen-sinh-2026",
    applicable_year: 2026,
    issue_date: "2026-01-15",
    version: "v2.1",
    status: "ready",
    chunks_count: 142,
    size_mb: 3.4,
    updated_at: "2026-02-10T08:30:00Z"
  },
  {
    document_id: "doc-vku-academic-regs-2025",
    title: "Quy chế đào tạo trình độ Đại học theo hệ thống tín chỉ VKU",
    category: "academic",
    source_url: "https://vku.udn.vn/dao-tao/quy-che-tin-chi",
    applicable_year: 2025,
    issue_date: "2025-08-20",
    version: "v1.4",
    status: "ready",
    chunks_count: 215,
    size_mb: 5.1,
    updated_at: "2025-09-01T14:15:00Z"
  },
  {
    document_id: "doc-vku-scholarships-2026",
    title: "Chính sách học bổng tuyển sinh và khuyến khích học tập VKU",
    category: "admissions",
    source_url: "https://vku.udn.vn/hoc-bong-tai-tro-2026",
    applicable_year: 2026,
    issue_date: "2026-02-01",
    version: "v1.0",
    status: "ready",
    chunks_count: 68,
    size_mb: 1.8,
    updated_at: "2026-02-15T09:00:00Z"
  },
  {
    document_id: "doc-vku-graduation-benchmark",
    title: "Quy định chuẩn đầu ra ngoại ngữ (TOEIC/IELTS) và chuẩn CNTT sinh viên VKU",
    category: "academic",
    source_url: "https://vku.udn.vn/chuan-dau-ra-tot-nghiep",
    applicable_year: 2024,
    issue_date: "2024-11-10",
    version: "v2.0",
    status: "ready",
    chunks_count: 94,
    size_mb: 2.2,
    updated_at: "2025-01-12T10:45:00Z"
  },
  {
    document_id: "doc-vku-tuition-fee-2026",
    title: "Mức thu học phí năm học 2025 - 2026 các ngành đào tạo VKU",
    category: "academic",
    source_url: "https://vku.udn.vn/thong-bao-hoc-phi-2026",
    applicable_year: 2026,
    issue_date: "2025-07-28",
    version: "v1.1",
    status: "ready",
    chunks_count: 53,
    size_mb: 1.2,
    updated_at: "2025-08-05T11:20:00Z"
  }
];

export const MOCK_QA_DATABASE = [
  {
    keywords: ["học phí", "chi phí", "bao nhiêu tiền", "tiền học"],
    status: "answered",
    answer: "Theo **Thông báo mức thu học phí năm học 2025 - 2026** của Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn [S1]:\n\n- **Chương trình đại trà (Kỹ sư CNTT, Kỹ thuật Máy tính, An toàn thông tin, Marketing số):** Bình quân từ **15.000.000đ - 18.500.000đ / năm học** (tùy theo số lượng tín chỉ thực tế sinh viên đăng ký, tương đương khoảng 450.000đ - 550.000đ/tín chỉ).\n- **Chương trình chất lượng cao / Song ngữ Anh - Hàn:** Khoảng **24.000.000đ - 28.000.000đ / năm học**.\n- Mức học phí được giữ ổn định và lộ trình tăng tuân thủ theo Nghị định 97/2023/NĐ-CP của Chính phủ.",
    sources: [
      {
        source_id: "S1",
        chunk_id: "chunk-tuition-2026-p2",
        document_id: "doc-vku-tuition-fee-2026",
        title: "Mức thu học phí năm học 2025 - 2026 các ngành đào tạo VKU",
        url: "https://vku.udn.vn/thong-bao-hoc-phi-2026",
        page_or_section: "Mục 2 - Biểu mức học phí theo tín chỉ",
        applicable_year: 2026,
        document_version: "v1.1"
      }
    ]
  },
  {
    keywords: ["học bổng", "tuyển sinh", "chính sách học bổng", "thủ khoa"],
    status: "answered",
    answer: "Trường Đại học CNTT & Truyền thông Việt - Hàn (VKU) áp dụng chính sách học bổng rất lớn dành cho tân sinh viên và sinh viên đang theo học [S1]:\n\n1. **Học bổng Thủ khoa/Á khoa đầu vào:** Miễn 100% học phí toàn khóa học + tài trợ sinh hoạt phí và chỗ ở ký túc xá miễn phí.\n2. **Học bổng Tài năng (Học sinh đoạt giải Quốc gia, Quốc tế):** Miễn 100% học phí 4 năm học và ưu tiên tham gia các dự án nghiên cứu chuyển giao công nghệ cùng đối tác Hàn Quốc.\n3. **Học bổng Doanh nghiệp & Quỹ hỗ trợ ODA Hàn Quốc:** Hơn 100 suất học bổng tài trợ hàng năm từ Tập đoàn Hanwha, LG, Samsung, KOICA trị giá từ 10.000.000đ đến 50.000.000đ/suất.\n4. **Học bổng khuyến khích học tập:** Xét theo từng học kỳ dựa trên điểm rèn luyện và GPA (Loại Xuất sắc, Giỏi, Khá) [S2].",
    sources: [
      {
        source_id: "S1",
        chunk_id: "chunk-sch-p1",
        document_id: "doc-vku-scholarships-2026",
        title: "Chính sách học bổng tuyển sinh và khuyến khích học tập VKU",
        url: "https://vku.udn.vn/hoc-bong-tai-tro-2026",
        page_or_section: "Trang 3, Điều 4 - Học bổng dành cho tân sinh viên",
        applicable_year: 2026,
        document_version: "v1.0"
      },
      {
        source_id: "S2",
        chunk_id: "chunk-sch-p5",
        document_id: "doc-vku-scholarships-2026",
        title: "Chính sách học bổng tuyển sinh và khuyến khích học tập VKU",
        url: "https://vku.udn.vn/hoc-bong-tai-tro-2026",
        page_or_section: "Trang 7, Điều 9 - Tiêu chuẩn xét học bổng định kỳ",
        applicable_year: 2026,
        document_version: "v1.0"
      }
    ]
  },
  {
    keywords: ["phương thức xét tuyển", "xét tuyển", "tuyển sinh 2026", "phương thức"],
    status: "answered",
    answer: "Năm 2026, VKU triển khai 5 phương thức tuyển sinh chính quy cho tất cả các ngành đào tạo [S1]:\n\n- **Phương thức 1:** Xét tuyển thẳng theo quy chế của Bộ Giáo dục và Đào tạo (Học sinh đoạt giải HSG Quốc gia, KHKT).\n- **Phương thức 2:** Xét tuyển theo kết quả học tập THPT (Học bạ) kết hợp bài thi đánh giá năng lực hoặc thành tích học sinh giỏi trường chuyên.\n- **Phương thức 3:** Xét tuyển dựa trên kết quả thi Đánh giá năng lực của ĐHQG TP.HCM hoặc ĐHQG Hà Nội năm 2026.\n- **Phương thức 4:** Xét tuyển thẳng theo đề án tuyển sinh riêng của VKU (chứng chỉ quốc tế IELTS ≥ 5.5, TOEFL, TOPIK kết hợp điểm học bạ).\n- **Phương thức 5:** Xét tuyển dựa trên điểm thi tốt nghiệp THPT năm 2026.",
    sources: [
      {
        source_id: "S1",
        chunk_id: "chunk-adm-p4",
        document_id: "doc-vku-admissions-2026",
        title: "Đề án tuyển sinh Đại học chính quy VKU năm 2026",
        url: "https://vku.udn.vn/tuyen-sinh/de-an-tuyen-sinh-2026",
        page_or_section: "Mục III - Phương thức và điều kiện tuyển sinh",
        applicable_year: 2026,
        document_version: "v2.1"
      }
    ]
  },
  {
    keywords: ["chuẩn đầu ra", "tiếng anh", "ngoại ngữ", "toeic", "ielts", "tốt nghiệp"],
    status: "answered",
    answer: "Theo quy định chuẩn đầu ra của VKU áp dụng cho sinh viên tốt nghiệp [S1]:\n\n1. **Chuẩn ngoại ngữ chính (Tiếng Anh):**\n   - Khối ngành Công nghệ (CNTT, ATTT, Kỹ thuật máy tính): Tối thiểu **TOEIC 550 điểm** quốc tế (hoặc IELTS 5.0, TOEFL iBT 45).\n   - Khối ngành Kinh tế số & Thương mại điện tử: Tối thiểu **TOEIC 600 điểm** quốc tế (hoặc IELTS 5.5).\n2. **Ngoại ngữ hai / Tiếng Hàn (nếu thuộc hệ chuyên ban hoặc song ngữ):** Đạt chứng chỉ TOPIK level 3 trở lên.\n3. **Chuẩn kỹ năng CNTT:** Hoàn thành bài thi chuẩn kỹ năng ứng dụng CNTT nâng cao hoặc đạt các chứng chỉ quốc tế tương đương (MOS, IC3).",
    sources: [
      {
        source_id: "S1",
        chunk_id: "chunk-grad-p3",
        document_id: "doc-vku-graduation-benchmark",
        title: "Quy định chuẩn đầu ra ngoại ngữ (TOEIC/IELTS) và chuẩn CNTT sinh viên VKU",
        url: "https://vku.udn.vn/chuan-dau-ra-tot-nghiep",
        page_or_section: "Điều 5 - Chuẩn trình độ ngoại ngữ đối với bậc đại học",
        applicable_year: 2024,
        document_version: "v2.0"
      }
    ]
  },
  {
    keywords: ["cảnh báo học vụ", "buộc thôi học", "điểm f", "nợ môn"],
    status: "answered",
    answer: "Theo **Quy chế đào tạo học chế tín chỉ VKU** [S1]:\n\n- **Cảnh báo học vụ:** Sinh viên bị cảnh báo kết quả học tập nếu thuộc một trong các trường hợp:\n  + Điểm trung bình học kỳ đạt dưới 1.00 (thang 4) đối với học kỳ đầu tiên, hoặc dưới 1.20 đối với các học kỳ tiếp theo.\n  + Điểm trung bình tích lũy đạt dưới 1.20 (sinh viên năm 1), dưới 1.40 (sinh viên năm 2), dưới 1.60 (sinh viên năm 3) hoặc dưới 1.80 (các năm tiếp theo).\n  + Tổng số tín chỉ chưa đạt (điểm F) vượt quá 24 tín chỉ.\n- **Buộc thôi học:** Sinh viên bị buộc thôi học nếu bị cảnh báo học tập 3 lần liên tiếp.",
    sources: [
      {
        source_id: "S1",
        chunk_id: "chunk-acad-p12",
        document_id: "doc-vku-academic-regs-2025",
        title: "Quy chế đào tạo trình độ Đại học theo hệ thống tín chỉ VKU",
        url: "https://vku.udn.vn/dao-tao/quy-che-tin-chi",
        page_or_section: "Chương IV, Điều 18 - Xử lý học vụ và cảnh báo kết quả học tập",
        applicable_year: 2025,
        document_version: "v1.4"
      }
    ]
  }
];

export const MOCK_CLARIFICATION_ANSWER = {
  status: "needs_clarification",
  answer: "Hệ thống nhận thấy câu hỏi của bạn có thể áp dụng cho nhiều chương trình hoặc khóa đào tạo khác nhau tại VKU. Để tra cứu chính xác quy định và trích dẫn văn bản tương ứng, vui lòng chọn hoặc nêu rõ:\n\n1. **Năm tuyển sinh hoặc Khóa đào tạo:** Bạn đang quan tâm đến năm tuyển sinh 2026, khóa 2025 (K25) hay các khóa trước đó?\n2. **Hệ đào tạo:** Đại học chính quy đại trà, Chương trình Kỹ sư chất lượng cao hay Chương trình liên kết quốc tế?",
  sources: []
};

export const MOCK_INSUFFICIENT_EVIDENCE = {
  status: "insufficient_evidence",
  answer: "Rất tiếc, kho tài liệu chính thức hiện tại của VKU chưa có đủ thông tin hoặc văn bản quy định cụ thể về câu hỏi này. Bạn vui lòng liên hệ trực tiếp **Phòng Đào tạo VKU (ĐT: 0236.3.667.117)** hoặc **Tổ Tư vấn tuyển sinh VKU** để được hỗ trợ chính xác nhất.",
  sources: []
};
