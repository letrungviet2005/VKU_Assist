/**
 * High-fidelity mock knowledge base for VKU Assist
 * Used for development, testing error edge-cases, and offline demos.
 */

export const INITIAL_DOCUMENTS = [
  {
    document_id: "admissions-402-2026",
    title: "Phương thức xét tuyển theo kết quả điểm thi ĐGNL ĐHQG TP. HCM (Mã 402 - 2026)",
    category: "admissions",
    source_url: "https://tuyensinh.vku.udn.vn/thong-bao/69af034de1fedb5e0308e872",
    applicable_year: 2026,
    issue_date: "2026-02-10",
    version: "html-snapshot-000dd3fa9959",
    status: "ready",
    chunks_count: 4,
    size_mb: 0.1,
    updated_at: "2026-02-10T08:30:00Z",
    summary: "Thông báo chính thức từ cổng Tuyển sinh VKU về phương thức xét tuyển kết quả kỳ thi Đánh giá năng lực ĐHQG TP.HCM năm 2026 (mã phương thức 402).",
    sections_preview: [
      "a) Mã phương thức xét tuyển: 402",
      "b) Đối tượng xét tuyển",
      "c) Nguyên tắc xét tuyển & Quy đổi thang điểm 30",
    ],
  },
  {
    document_id: "admissions-entry-2026",
    title: "Công bố điểm trúng tuyển Đại học chính quy VKU năm 2026",
    category: "admissions",
    source_url: "https://tuyensinh.vku.udn.vn/thong-bao/6a79472c0619ded1f20e9b44",
    applicable_year: 2026,
    issue_date: "2026-08-09",
    version: "html-snapshot-dd7889c08ec9",
    status: "ready",
    chunks_count: 4,
    size_mb: 0.1,
    updated_at: "2026-08-09T09:00:00Z",
    summary: "Thông báo công bố điểm trúng tuyển 2026 và các mốc xác nhận nhập học Bộ GD&ĐT, nhập học trực tuyến và nhập học trực tiếp tại 470 Trần Đại Nghĩa, Đà Nẵng.",
    sections_preview: [
      "Xác nhận nhập học Bộ GD&ĐT (trước 17h ngày 21/8/2026)",
      "Nhập học trực tuyến nhaphoc.vku.udn.vn (17/8 - 30/8/2026)",
      "Nhập học trực tiếp tại VKU (07h30 ngày 03/9/2026)",
    ],
  },
  {
    document_id: "academic-graduation-3-2026",
    title: "[Thông báo] Nhận hồ sơ xét tốt nghiệp đợt 3 năm 2026",
    category: "academic",
    source_url: "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-3-nam-2026-1358.html",
    applicable_year: 2026,
    issue_date: "2026-06-16",
    version: "html-snapshot-b83d827cd463",
    status: "ready",
    chunks_count: 10,
    size_mb: 0.2,
    updated_at: "2026-06-16T10:00:00Z",
    summary: "Thông báo Phòng Đào tạo VKU về đối tượng, thành phần hồ sơ và thời gian nhận hồ sơ xét công nhận tốt nghiệp đợt 3 năm 2026 (20/06/2026 - 15/07/2026).",
    sections_preview: [
      "1. Đối tượng (Đúng hạn K22 cử nhân / Trễ hạn K21 trở về trước)",
      "2. Danh mục 6 thành phần hồ sơ xét tốt nghiệp",
      "3. Thời gian nhận: 20/06/2026 - 15/07/2026",
    ],
  },
  {
    document_id: "academic-graduation-4-2026",
    title: "[Thông báo] Nhận hồ sơ xét tốt nghiệp đợt 4 năm 2026",
    category: "academic",
    source_url: "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-4-nam-2026-1385.html",
    applicable_year: 2026,
    issue_date: "2026-09-13",
    version: "html-snapshot-43dfaf915e95",
    status: "ready",
    chunks_count: 11,
    size_mb: 0.2,
    updated_at: "2026-09-13T10:00:00Z",
    summary: "Thông báo Phòng Đào tạo VKU về xét tốt nghiệp đợt 4 năm 2026 dành cho nhóm tốt nghiệp trễ hạn (15/09/2026 - 30/09/2026).",
    sections_preview: [
      "1. Đối tượng tốt nghiệp trễ hạn (K21 trở về trước & K22 cử nhân)",
      "2. Hồ sơ đề nghị & Cách đặt tên file nộp trực tuyến",
      "3. Thời gian nhận: 15/9/2026 - 30/9/2026",
    ],
  },
  {
    document_id: "doc-vku-admissions-2026",
    title: "Cổng thông tin Tuyển sinh Đại học chính quy VKU",
    category: "admissions",
    source_url: "https://tuyensinh.vku.udn.vn/",
    applicable_year: 2026,
    issue_date: "2026-01-15",
    version: "v2.1",
    status: "ready",
    chunks_count: 142,
    size_mb: 3.4,
    updated_at: "2026-02-10T08:30:00Z",
    summary: "Tổng hợp 5 phương thức xét tuyển, chỉ tiêu ngành học, ngưỡng đảm bảo chất lượng đầu vào và thông tin tuyển sinh Đại học chính quy VKU (dữ liệu tham chiếu mẫu).",
    sections_preview: [
      "Mục I - Chỉ tiêu & Danh mục ngành đào tạo 2026",
      "Mục III - 5 Phương thức xét tuyển chính quy",
      "Mục IV - Quy đổi chứng chỉ IELTS / TOPIK",
    ],
  },
  {
    document_id: "doc-vku-academic-regs-2025",
    title: "Cổng thông tin Đào tạo & Quy chế học vụ VKU",
    category: "academic",
    source_url: "https://daotao.vku.udn.vn/",
    applicable_year: 2025,
    issue_date: "2025-08-20",
    version: "v1.4",
    status: "ready",
    chunks_count: 215,
    size_mb: 5.1,
    updated_at: "2025-09-01T14:15:00Z",
    summary: "Thông tin đăng ký tín chỉ, thang điểm 10 sang thang 4, điều kiện cảnh báo học vụ, buộc thôi học và công nhận tốt nghiệp (dữ liệu tham chiếu mẫu).",
    sections_preview: [
      "Chương II - Kế hoạch học tập & Đăng ký tín chỉ",
      "Chương III - Đánh giá học phần & Quy đổi thang điểm 4",
      "Chương IV, Điều 18 - Xử lý học vụ & Cảnh báo kết quả",
    ],
  },
  {
    document_id: "doc-vku-scholarships-2026",
    title: "Thông tin Học bổng & Hỗ trợ sinh viên VKU",
    category: "admissions",
    source_url: "https://tuyensinh.vku.udn.vn/",
    applicable_year: 2026,
    issue_date: "2026-02-01",
    version: "v1.0",
    status: "ready",
    chunks_count: 68,
    size_mb: 1.8,
    updated_at: "2026-02-15T09:00:00Z",
    summary: "Tổng hợp học bổng Thủ khoa/Á khoa, Học bổng Tài năng quốc tế, Quỹ tài trợ doanh nghiệp Hàn Quốc và học bổng KKHT (dữ liệu tham chiếu mẫu).",
    sections_preview: [
      "Điều 4 - Học bổng dành cho tân sinh viên",
      "Điều 7 - Học bổng Tài trợ Doanh nghiệp & ODA Hàn Quốc",
      "Điều 9 - Tiêu chuẩn xét học bổng định kỳ (GPA & ĐRL)",
    ],
  },
  {
    document_id: "doc-vku-graduation-benchmark",
    title: "Quy định chuẩn đầu ra ngoại ngữ (TOEIC/IELTS) và chuẩn CNTT VKU",
    category: "academic",
    source_url: "https://daotao.vku.udn.vn/",
    applicable_year: 2024,
    issue_date: "2024-11-10",
    version: "v2.0",
    status: "ready",
    chunks_count: 94,
    size_mb: 2.2,
    updated_at: "2025-01-12T10:45:00Z",
    summary: "Chuẩn chứng chỉ tiếng Anh tối thiểu theo khối ngành Công nghệ và Kinh tế số, chứng chỉ TOPIK cho hệ song ngữ Hàn và chuẩn kỹ năng CNTT (dữ liệu tham chiếu mẫu).",
    sections_preview: [
      "Điều 5 - Chuẩn trình độ ngoại ngữ bậc đại học",
      "Điều 6 - Chuẩn ngoại ngữ hai (TOPIK 3) hệ song ngữ",
      "Điều 8 - Chuẩn kỹ năng CNTT nâng cao (MOS/IC3)",
    ],
  },
  {
    document_id: "doc-vku-tuition-fee-2026",
    title: "Thông tin Học phí các ngành đào tạo VKU",
    category: "academic",
    source_url: "https://vku.udn.vn/",
    applicable_year: 2026,
    issue_date: "2025-07-28",
    version: "v1.1",
    status: "ready",
    chunks_count: 53,
    size_mb: 1.2,
    updated_at: "2025-08-05T11:20:00Z",
    summary: "Mức thu học phí tham khảo theo tín chỉ đối với chương trình đại trà, chất lượng cao và song ngữ Anh - Hàn (dữ liệu tham chiếu mẫu).",
    sections_preview: [
      "Mục 1 - Nguyên tắc tính học phí theo tín chỉ",
      "Mục 2 - Biểu mức học phí tham khảo theo tín chỉ",
    ],
  }
];

export const MOCK_DOCUMENT_CHUNKS = [
  {
    chunk_id: "chunk-tuition-2026-p2",
    document_id: "doc-vku-tuition-fee-2026",
    title: "Thông tin Học phí các ngành đào tạo VKU",
    source_url: "https://vku.udn.vn/",
    page_or_section: "Mục 2 - Biểu mức học phí theo tín chỉ",
    category: "academic",
    applicable_year: 2026,
    document_version: "v1.1",
    text: "Chương trình đại trà (Kỹ sư CNTT, Kỹ thuật Máy tính, An toàn thông tin, Marketing số) có mức thu bình quân từ 15.000.000đ - 18.500.000đ/năm học (tương đương 450.000đ - 550.000đ/tín chỉ). Chương trình chất lượng cao / Song ngữ Anh - Hàn dao động khoảng 24.000.000đ - 28.000.000đ/năm học, tuân thủ lộ trình Nghị định 97/2023/NĐ-CP.",
    score: 0.94,
  },
  {
    chunk_id: "chunk-sch-p1",
    document_id: "doc-vku-scholarships-2026",
    title: "Thông tin Học bổng & Hỗ trợ sinh viên VKU",
    source_url: "https://tuyensinh.vku.udn.vn/",
    page_or_section: "Trang 3, Điều 4 - Học bổng dành cho tân sinh viên",
    category: "admissions",
    applicable_year: 2026,
    document_version: "v1.0",
    text: "Tân sinh viên đạt Thủ khoa/Á khoa đầu vào được miễn 100% học phí toàn khóa học kèm hỗ trợ ký túc xá miễn phí. Sinh viên đoạt giải Học sinh giỏi Quốc gia/Quốc tế nhận Học bổng Tài năng miễn 100% học phí 4 năm và ưu tiên tham gia dự án nghiên cứu cùng đối tác Hàn Quốc.",
    score: 0.92,
  },
  {
    chunk_id: "chunk-sch-p5",
    document_id: "doc-vku-scholarships-2026",
    title: "Thông tin Học bổng & Hỗ trợ sinh viên VKU",
    source_url: "https://tuyensinh.vku.udn.vn/",
    page_or_section: "Trang 7, Điều 9 - Tiêu chuẩn xét học bổng định kỳ",
    category: "admissions",
    applicable_year: 2026,
    document_version: "v1.0",
    text: "Học bổng khuyến khích học tập (KKHT) được xét theo từng học kỳ dựa trên điểm trung bình học kỳ (GPA ≥ 2.50 cho loại Khá, ≥ 3.20 cho loại Giỏi, ≥ 3.60 cho loại Xuất sắc) kết hợp điểm rèn luyện đạt từ loại Tốt (≥ 80 điểm) trở lên và không có học phần điểm F trong kỳ xét.",
    score: 0.89,
  },
  {
    chunk_id: "chunk-adm-p4",
    document_id: "doc-vku-admissions-2026",
    title: "Cổng thông tin Tuyển sinh Đại học chính quy VKU",
    source_url: "https://tuyensinh.vku.udn.vn/",
    page_or_section: "Mục III - Phương thức và điều kiện tuyển sinh",
    category: "admissions",
    applicable_year: 2026,
    document_version: "v2.1",
    text: "Năm 2026 VKU áp dụng 5 phương thức tuyển sinh chính quy: (1) Xét tuyển thẳng theo quy chế Bộ GD&ĐT; (2) Xét học bạ THPT kết hợp thành tích/ĐGNL; (3) Xét điểm thi Đánh giá năng lực ĐHQG TP.HCM hoặc Hà Nội; (4) Xét tuyển thẳng theo đề án riêng của VKU (IELTS ≥ 5.5, TOPIK, giải thưởng); (5) Xét điểm thi tốt nghiệp THPT 2026.",
    score: 0.95,
  },
  {
    chunk_id: "chunk-grad-p3",
    document_id: "doc-vku-graduation-benchmark",
    title: "Quy định chuẩn đầu ra ngoại ngữ (TOEIC/IELTS) và chuẩn CNTT VKU",
    source_url: "https://daotao.vku.udn.vn/",
    page_or_section: "Điều 5 - Chuẩn trình độ ngoại ngữ đối với bậc đại học",
    category: "academic",
    applicable_year: 2024,
    document_version: "v2.0",
    text: "Chuẩn ngoại ngữ tốt nghiệp đại học: Khối ngành Công nghệ (CNTT, ATTT, Kỹ thuật máy tính) yêu cầu tối thiểu TOEIC 550 hoặc IELTS 5.0 / TOEFL iBT 45. Khối ngành Kinh tế số & TMĐT yêu cầu tối thiểu TOEIC 600 hoặc IELTS 5.5. Hệ song ngữ tiếng Hàn cần thêm TOPIK cấp độ 3. Chuẩn CNTT đạt chứng chỉ MOS/IC3 hoặc kỳ thi chuẩn CNTT nâng cao.",
    score: 0.93,
  },
  {
    chunk_id: "chunk-acad-p12",
    document_id: "doc-vku-academic-regs-2025",
    title: "Cổng thông tin Đào tạo & Quy chế học vụ VKU",
    source_url: "https://daotao.vku.udn.vn/",
    page_or_section: "Chương IV, Điều 18 - Xử lý học vụ và cảnh báo kết quả học tập",
    category: "academic",
    applicable_year: 2025,
    document_version: "v1.4",
    text: "Sinh viên bị cảnh báo kết quả học tập khi điểm TBHK < 1.00 (kỳ 1) hoặc < 1.20 (các kỳ sau); hoặc điểm TB tích lũy < 1.20 (năm 1), < 1.40 (năm 2), < 1.60 (năm 3), < 1.80 (năm 4+); hoặc tổng số tín chỉ nợ (điểm F) vượt quá 24 tín chỉ. Cảnh báo học tập 3 lần liên tiếp dẫn đến buộc thôi học.",
    score: 0.91,
  },
  {
    chunk_id: "chunk-pilot-grad-4",
    document_id: "academic-graduation-4-2026",
    title: "[Thông báo] Nhận hồ sơ xét tốt nghiệp đợt 4 năm 2026",
    source_url: "https://daotao.vku.udn.vn/thong-bao-dao-tao/thong-bao-nhan-ho-so-xet-tot-nghiep-dot-4-nam-2026-1385.html",
    page_or_section: "Mục 1 & 3 - Đối tượng & Thời gian nhận hồ sơ đợt 4",
    category: "academic",
    applicable_year: 2026,
    document_version: "html-snapshot-43dfaf915e95",
    text: "Xét tốt nghiệp đợt 4 năm 2026 áp dụng cho nhóm tốt nghiệp trễ hạn (Đại học K21 trở về trước và K22 - cử nhân; Cao đẳng K19 trở về trước). Thời gian nhận hồ sơ: 15/9/2026 - 30/9/2026.",
    score: 0.96,
  },
  {
    chunk_id: "chunk-pilot-entry-2026",
    document_id: "admissions-entry-2026",
    title: "Công bố điểm trúng tuyển Đại học chính quy VKU năm 2026",
    source_url: "https://tuyensinh.vku.udn.vn/thong-bao/6a79472c0619ded1f20e9b44",
    page_or_section: "Các mốc xác nhận & nhập học Tân sinh viên K26",
    category: "admissions",
    applicable_year: 2026,
    document_version: "html-snapshot-dd7889c08ec9",
    text: "Tân sinh viên VKU 2026 xác nhận nhập học trên hệ thống Bộ GD&ĐT trước 17h ngày 21/8/2026; nhập học trực tuyến tại nhaphoc.vku.udn.vn từ 17/8 - 30/8/2026; nhập học trực tiếp tại 470 Trần Đại Nghĩa, Đà Nẵng lúc 07h30 ngày 03/9/2026.",
    score: 0.96,
  }
];

export const MOCK_QA_DATABASE = [
  {
    keywords: ["học phí", "chi phí", "bao nhiêu tiền", "tiền học"],
    status: "answered",
    answer: "Theo **Thông báo mức thu học phí năm học 2025 - 2026** của Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn [S1]:\n\n- **Chương trình đại trà (Kỹ sư CNTT, Kỹ thuật Máy tính, An toàn thông tin, Marketing số):** Bình quân từ **15.000.000đ - 18.500.000đ / năm học** (tùy theo số lượng tín chỉ thực tế sinh viên đăng ký, tương đương khoảng 450.000đ - 550.000đ/tín chỉ).\n- **Chương trình chất lượng cao / Song ngữ Anh - Hàn:** Khoảng **24.000.000đ - 28.000.000đ / năm học**.\n- Mức học phí được giữ ổn định và lộ trình tăng tuân thủ theo Nghị định 97/2023/NĐ-CP của Chính phủ.",
    followups: [
      "Học bổng khuyến khích học tập xét theo điều kiện gì?",
      "Chính sách miễn giảm học phí cho tân sinh viên Thủ khoa?",
    ],
    sources: [
      {
        ...MOCK_DOCUMENT_CHUNKS[0],
        source_id: "S1",
        snippet: MOCK_DOCUMENT_CHUNKS[0].text,
      }
    ]
  },
  {
    keywords: ["học bổng", "chính sách học bổng", "thủ khoa", "hanwha", "koica"],
    status: "answered",
    answer: "Trường Đại học CNTT & Truyền thông Việt - Hàn (VKU) áp dụng chính sách học bổng rất lớn dành cho tân sinh viên và sinh viên đang theo học [S1]:\n\n1. **Học bổng Thủ khoa/Á khoa đầu vào:** Miễn 100% học phí toàn khóa học + tài trợ sinh hoạt phí và chỗ ở ký túc xá miễn phí.\n2. **Học bổng Tài năng (Học sinh đoạt giải Quốc gia, Quốc tế):** Miễn 100% học phí 4 năm học và ưu tiên tham gia các dự án nghiên cứu chuyển giao công nghệ cùng đối tác Hàn Quốc.\n3. **Học bổng Doanh nghiệp & Quỹ hỗ trợ ODA Hàn Quốc:** Hơn 100 suất học bổng tài trợ hàng năm từ Tập đoàn Hanwha, LG, Samsung, KOICA trị giá từ 10.000.000đ đến 50.000.000đ/suất.\n4. **Học bổng khuyến khích học tập:** Xét theo từng học kỳ dựa trên điểm rèn luyện và GPA (Loại Xuất sắc, Giỏi, Khá) [S2].",
    followups: [
      "Mức GPA tối thiểu để nhận học bổng KKHT là bao nhiêu?",
      "5 phương thức xét tuyển Đại học VKU năm 2026?",
    ],
    sources: [
      {
        ...MOCK_DOCUMENT_CHUNKS[1],
        source_id: "S1",
        snippet: MOCK_DOCUMENT_CHUNKS[1].text,
      },
      {
        ...MOCK_DOCUMENT_CHUNKS[2],
        source_id: "S2",
        snippet: MOCK_DOCUMENT_CHUNKS[2].text,
      }
    ]
  },
  {
    keywords: ["phương thức xét tuyển", "xét tuyển", "tuyển sinh 2026", "phương thức", "đgnl"],
    status: "answered",
    answer: "Năm 2026, VKU triển khai 5 phương thức tuyển sinh chính quy cho tất cả các ngành đào tạo [S1]:\n\n- **Phương thức 1:** Xét tuyển thẳng theo quy chế của Bộ Giáo dục và Đào tạo (Học sinh đoạt giải HSG Quốc gia, KHKT).\n- **Phương thức 2:** Xét tuyển theo kết quả học tập THPT (Học bạ) kết hợp bài thi đánh giá năng lực hoặc thành tích học sinh giỏi trường chuyên.\n- **Phương thức 3:** Xét tuyển dựa trên kết quả thi Đánh giá năng lực của ĐHQG TP.HCM hoặc ĐHQG Hà Nội năm 2026.\n- **Phương thức 4:** Xét tuyển thẳng theo đề án tuyển sinh riêng của VKU (chứng chỉ quốc tế IELTS ≥ 5.5, TOEFL, TOPIK kết hợp điểm học bạ).\n- **Phương thức 5:** Xét tuyển dựa trên điểm thi tốt nghiệp THPT năm 2026.",
    followups: [
      "Học phí và chính sách học bổng năm 2026?",
      "Xét tuyển riêng bằng IELTS yêu cầu mức điểm tối thiểu nào?",
    ],
    sources: [
      {
        ...MOCK_DOCUMENT_CHUNKS[3],
        source_id: "S1",
        snippet: MOCK_DOCUMENT_CHUNKS[3].text,
      }
    ]
  },
  {
    keywords: ["chuẩn đầu ra", "tiếng anh", "ngoại ngữ", "toeic", "ielts", "tốt nghiệp", "topik"],
    status: "answered",
    answer: "Theo quy định chuẩn đầu ra của VKU áp dụng cho sinh viên tốt nghiệp [S1]:\n\n1. **Chuẩn ngoại ngữ chính (Tiếng Anh):**\n   - Khối ngành Công nghệ (CNTT, ATTT, Kỹ thuật máy tính): Tối thiểu **TOEIC 550 điểm** quốc tế (hoặc IELTS 5.0, TOEFL iBT 45).\n   - Khối ngành Kinh tế số & Thương mại điện tử: Tối thiểu **TOEIC 600 điểm** quốc tế (hoặc IELTS 5.5).\n2. **Ngoại ngữ hai / Tiếng Hàn (nếu thuộc hệ chuyên ban hoặc song ngữ):** Đạt chứng chỉ TOPIK level 3 trở lên.\n3. **Chuẩn kỹ năng CNTT:** Hoàn thành bài thi chuẩn kỹ năng ứng dụng CNTT nâng cao hoặc đạt các chứng chỉ quốc tế tương đương (MOS, IC3).",
    followups: [
      "Điều kiện bị cảnh báo học vụ và thôi học?",
      "Kiểm tra checklist tốt nghiệp của tôi",
    ],
    sources: [
      {
        ...MOCK_DOCUMENT_CHUNKS[4],
        source_id: "S1",
        snippet: MOCK_DOCUMENT_CHUNKS[4].text,
      }
    ]
  },
  {
    keywords: ["cảnh báo học vụ", "buộc thôi học", "điểm f", "nợ môn", "gpa", "thôi học"],
    status: "answered",
    answer: "Theo **Quy chế đào tạo học chế tín chỉ VKU** [S1]:\n\n- **Cảnh báo học vụ:** Sinh viên bị cảnh báo kết quả học tập nếu thuộc một trong các trường hợp:\n  + Điểm trung bình học kỳ đạt dưới 1.00 (thang 4) đối với học kỳ đầu tiên, hoặc dưới 1.20 đối với các học kỳ tiếp theo.\n  + Điểm trung bình tích lũy đạt dưới 1.20 (sinh viên năm 1), dưới 1.40 (sinh viên năm 2), dưới 1.60 (sinh viên năm 3) hoặc dưới 1.80 (các năm tiếp theo).\n  + Tổng số tín chỉ chưa đạt (điểm F) vượt quá 24 tín chỉ.\n- **Buộc thôi học:** Sinh viên bị buộc thôi học nếu bị cảnh báo học tập 3 lần liên tiếp.",
    followups: [
      "Chuẩn đầu ra ngoại ngữ TOEIC để tốt nghiệp?",
      "Mức học phí học lại theo tín chỉ là bao nhiêu?",
    ],
    sources: [
      {
        ...MOCK_DOCUMENT_CHUNKS[5],
        source_id: "S1",
        snippet: MOCK_DOCUMENT_CHUNKS[5].text,
      }
    ]
  }
];

export const MOCK_CLARIFICATION_ANSWER = {
  status: "needs_clarification",
  answer: "Hệ thống nhận thấy câu hỏi của bạn có thể áp dụng cho nhiều chương trình hoặc khóa đào tạo khác nhau tại VKU. Để tra cứu chính xác quy định và trích dẫn văn bản tương ứng, vui lòng chọn hoặc nêu rõ:\n\n1. **Năm tuyển sinh hoặc Khóa đào tạo:** Bạn đang quan tâm đến năm tuyển sinh 2026, khóa 2025 (K25) hay các khóa trước đó?\n2. **Hệ đào tạo:** Đại học chính quy đại trà, Chương trình Kỹ sư chất lượng cao hay Chương trình liên kết quốc tế?",
  sources: [],
  followups: [
    "Áp dụng cho năm 2026, hệ Đại trà",
    "Áp dụng cho chương trình Chất lượng cao / Song ngữ",
  ],
};

export const MOCK_INSUFFICIENT_EVIDENCE = {
  status: "insufficient_evidence",
  answer: "Rất tiếc, kho tài liệu chính thức hiện tại của VKU chưa có đủ thông tin hoặc văn bản quy định cụ thể về câu hỏi này. Bạn vui lòng liên hệ trực tiếp **Phòng Đào tạo VKU (ĐT: 0236.3.667.117)** hoặc **Tổ Tư vấn tuyển sinh VKU** để được hỗ trợ chính xác nhất.",
  sources: [],
  followups: [
    "5 phương thức xét tuyển Đại học VKU",
    "Học phí và chính sách học bổng năm 2026?",
  ],
};

export const PILOT_EVAL_SUMMARY = {
  datasetName: "VKU Pilot Benchmark (Real Public HTML)",
  totalQuestions: 12,
  indexedDocuments: 4,
  indexedChunks: 29,
  breakdown: [
    { group: "VKU-P01 – P04 (Tuyển sinh)", count: 4, status: "Draft / Chờ duyệt nguồn" },
    { group: "VKU-P05 – P08 (Học vụ)", count: 4, status: "Draft / Chờ duyệt nguồn" },
    { group: "VKU-P09 – P10 (Cần làm rõ đợt xét)", count: 2, status: "Cần đối chiếu chunk" },
    { group: "VKU-P11 – P12 (Ngoài phạm vi 2027)", count: 2, status: "Kiểm thử từ chối an toàn" },
  ],
};
