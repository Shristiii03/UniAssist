import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'campus_assistant.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const DOCUMENT_CATEGORIES = [
  'Academics',
  'Attendance',
  'Examinations',
  'Admissions',
  'Placements',
  'Fees',
  'Scholarships',
  'Events',
  'Hostel',
  'General Information',
] as const;

export const DEPARTMENTS = [
  'All Departments',
  'Computer Science',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Civil Engineering',
  'Business Administration',
] as const;

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      hashed_password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      department TEXT NOT NULL DEFAULT 'All Departments',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      category TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'All Departments',
      page_count INTEGER NOT NULL DEFAULT 1,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      upload_date TEXT NOT NULL DEFAULT (datetime('now')),
      processing_status TEXT NOT NULL DEFAULT 'completed' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      page_number INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      embedding_json TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'All Departments',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
      message TEXT NOT NULL,
      sources_json TEXT,
      feedback TEXT CHECK (feedback IN ('up', 'down') OR feedback IS NULL),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'All Departments',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT 'All Departments',
      author_name TEXT NOT NULL DEFAULT 'Office of Academic Affairs',
      published_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialKnowledgeBase();
}

function seedInitialKnowledgeBase() {
  const docCount = (db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }).cnt;
  if (docCount === 0) {
    const insertDoc = db.prepare(`
      INSERT INTO documents (filename, original_name, category, department, page_count, chunk_count, processing_status)
      VALUES (?, ?, ?, ?, ?, ?, 'completed')
    `);
    const insertChunk = db.prepare(`
      INSERT INTO document_chunks (document_id, chunk_index, page_number, content)
      VALUES (?, ?, ?, ?)
    `);

    const seededDocs = [
      {
        filename: 'Academic_Attendance_Regulations_2026.pdf',
        original_name: 'Academic_Attendance_Regulations_2026.pdf',
        category: 'Attendance',
        department: 'All Departments',
        page_count: 6,
        chunks: [
          {
            page: 2,
            text: 'Section 3.1 Minimum Attendance Requirement: Every student is required to maintain a minimum of 75% attendance in each registered course (theory and laboratory separately) during a semester to be eligible to appear for the End-Semester Examinations. Attendance is calculated from the first scheduled day of instruction up to the last instructional day before study leave.',
          },
          {
            page: 3,
            text: 'Section 3.2 Medical Condonation Policy: Students whose attendance falls between 65% and 74.9% strictly due to prolonged hospitalization, verified infectious illness, or family bereavement may apply for condonation. A condonation fee applies, and the application must be endorsed by the Faculty Advisor, Head of Department, and approved by the Dean of Academics at least 7 days before examinations begin.',
          },
          {
            page: 4,
            text: 'Section 3.3 Leave Application Procedure: Students requesting planned academic duty leave (hackathons, inter-university sports, NCC/NSS camps, or funded conferences) or medical leave must submit the Leave Request Form through the Student Portal. Supporting documentation—such as a registered medical practitioner certificate and prescriptions for medical leave, or an official event invitation endorsed by the Faculty Coordinator for duty leave—must be uploaded within 5 working days of returning to campus.',
          },
        ],
      },
      {
        filename: 'Examination_and_Grading_Manual_2026.pdf',
        original_name: 'Examination_and_Grading_Manual_2026.pdf',
        category: 'Examinations',
        department: 'All Departments',
        page_count: 10,
        chunks: [
          {
            page: 2,
            text: 'Section 1.4 Academic & Examination Schedule: Odd Semester classes run from August to November, with Mid-Semester Examinations held in Weeks 7–8 (typically late September) and End-Semester Theory Examinations conducted in late November through mid-December. Even Semester classes run from January to April, with Mid-Semester Examinations in March and End-Semester Examinations in late April through May. Practical and viva-voce assessments conclude one week prior to theory exams.',
          },
          {
            page: 5,
            text: 'Section 4.1 Evaluation Weightage & Hall Tickets: Continuous Internal Evaluation (CIE) accounts for 40% of total course marks (20% Mid-Semester Exam, 10% Quizzes & Assignments, 10% Lab/Class Participation), while the End-Semester Examination accounts for 60%. Students must carry their physical University ID Card and downloaded Hall Ticket (unlocked only after meeting attendance and fee clearance requirements) to enter the examination hall.',
          },
          {
            page: 7,
            text: 'Section 5.2 10-Point Relative & Absolute Grading System: Courses are evaluated on a 10-point grading scale. Grade O (Outstanding, 10 points, 90–100%), A+ (Excellent, 9 points, 80–89%), A (Very Good, 8 points, 70–79%), B+ (Good, 7 points, 60–69%), B (Above Average, 6 points, 55–59%), C (Average, 5 points, 45–54%), P (Pass, 4 points, 40–44%), and F (Fail, 0 points, below 40%). SGPA is the credit-weighted average of grade points in a semester; CGPA is the cumulative credit-weighted average across all completed semesters. Minimum passing score is 40% overall and at least 35% in the End-Semester Examination.',
          },
        ],
      },
      {
        filename: 'Placements_and_Career_Services_Policy.pdf',
        original_name: 'Placements_and_Career_Services_Policy.pdf',
        category: 'Placements',
        department: 'All Departments',
        page_count: 8,
        chunks: [
          {
            page: 1,
            text: 'Section 2.1 Placement Eligibility Criteria: Final-year undergraduate and postgraduate students are eligible to register for Campus Placement Drives provided they hold a minimum cumulative CGPA of 6.50 on a 10-point scale with zero active backlogs at the time of registration. Certain core product and analytics recruiters may specify a higher CGPA threshold of 7.50 or 8.00.',
          },
          {
            page: 3,
            text: 'Section 2.4 Training & Offer Policy: Registered candidates must attend at least 80% of Career Readiness Workshops, aptitude mock tests, and technical interviews arranged by the Training & Placement Cell. The university follows a "One Student, One Standard Offer" policy, with an option to upgrade once into a Dream Tier offer (compensation package >= 1.5x of the accepted base offer). Students opting for higher studies must submit a declaration prior to Drive Season.',
          },
        ],
      },
      {
        filename: 'Admissions_Fees_and_Hostel_Handbook.pdf',
        original_name: 'Admissions_Fees_and_Hostel_Handbook.pdf',
        category: 'Admissions',
        department: 'All Departments',
        page_count: 12,
        chunks: [
          {
            page: 2,
            text: 'Section 1.2 Documents Required for Admission: Newly admitted students must bring originals plus two self-attested photocopies of: (1) Class 10 and Class 12 marksheets and passing certificates, (2) Entrance Examination Rank Card & Seat Allotment Letter, (3) Transfer Certificate (TC) and Migration Certificate from the last attended institution, (4) Character/Conduct Certificate, (5) Government-issued Photo ID (Passport, National ID, or Driver License), (6) Six recent passport-size color photographs, (7) Category/Income Certificate if claiming reservation or scholarship, and (8) Signed Anti-Ragging Affidavit.',
          },
          {
            page: 6,
            text: 'Section 3.1 Tuition Fee & Scholarship Deadlines: Semester tuition fees are payable online via the Finance Portal within 15 days of semester commencement. Late payments incur a standard administrative surcharge of $25 per week after the grace window. Merit-cum-Means Scholarships waive 25% to 75% of tuition for students maintaining an annual SGPA of 8.50 or higher and verified family income below institutional thresholds.',
          },
          {
            page: 9,
            text: 'Section 6.1 Hostel Rules & Campus Facilities: Residential hostels provide single and twin-sharing furnished rooms, high-speed campus Wi-Fi, 24/7 reading rooms, and dining halls. Hostel curfew is 10:30 PM on weekdays and 11:30 PM on weekends; overnight leave requires parental digital consent via the Hostel Portal. The Central Library remains open from 8:00 AM to 11:00 PM Monday through Saturday (extended to 2:00 AM during examination weeks).',
          },
        ],
      },
    ];

    const tx = db.transaction(() => {
      for (const doc of seededDocs) {
        const res = insertDoc.run(
          doc.filename,
          doc.original_name,
          doc.category,
          doc.department,
          doc.page_count,
          doc.chunks.length
        );
        const docId = Number(res.lastInsertRowid);
        doc.chunks.forEach((chunk, idx) => {
          insertChunk.run(docId, idx, chunk.page, chunk.text);
        });
      }
    });
    tx();
  }

  const faqCount = (db.prepare('SELECT COUNT(*) as cnt FROM faqs').get() as { cnt: number }).cnt;
  if (faqCount === 0) {
    const insertFaq = db.prepare(`
      INSERT INTO faqs (question, answer, category, department) VALUES (?, ?, ?, ?)
    `);
    const seededFaqs = [
      [
        'What is the minimum attendance required to sit for semester exams?',
        'Students must maintain at least 75% attendance in each theory and lab course. Medical condonation down to 65% requires HOD and Dean approval with hospital or physician documentation.',
        'Attendance',
        'All Departments',
      ],
      [
        'How is CGPA calculated under the 10-point grading system?',
        'Grades range from O (10 points, 90–100%) to P (4 points, 40–44%). CGPA is the credit-weighted average of grade points earned across all completed semesters.',
        'Examinations',
        'All Departments',
      ],
      [
        'What is the eligibility criteria for campus placements?',
        'Students need a minimum 6.50 CGPA, zero active backlogs, and 80% attendance in Career Readiness training sessions.',
        'Placements',
        'All Departments',
      ],
      [
        'What are the Central Library operating hours?',
        'The Central Library is open 8:00 AM – 11:00 PM Monday to Saturday, and extends until 2:00 AM during Mid-Semester and End-Semester examination weeks.',
        'General Information',
        'All Departments',
      ],
    ];
    for (const [q, a, c, d] of seededFaqs) {
      insertFaq.run(q, a, c, d);
    }
  }

  const noticeCount = (db.prepare('SELECT COUNT(*) as cnt FROM notices').get() as { cnt: number }).cnt;
  if (noticeCount === 0) {
    const insertNotice = db.prepare(`
      INSERT INTO notices (title, content, category, department, author_name, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const seededNotices = [
      [
        'End-Semester Examination Timetable Released',
        'The final schedule for End-Semester Theory Examinations (Odd Semester) has been published. Students with 75%+ attendance and cleared semester dues can download Hall Tickets starting next Monday via the Student Portal.',
        'Examinations',
        'All Departments',
        'Controller of Examinations',
        '2026-11-20 10:00:00',
      ],
      [
        'Campus Placement Pre-Placement Talks — Engineering & Analytics',
        'Pre-placement briefings for final-year Computer Science, Electronics, and Mechanical cohorts begin Wednesday at 2:00 PM in Auditorium B. Carry your updated institutional resume.',
        'Placements',
        'Computer Science',
        'Training & Placement Cell',
        '2026-11-23 14:30:00',
      ],
      [
        'Merit-cum-Means Scholarship Renewal Window',
        'Continuing scholars with SGPA >= 8.50 in the previous academic year must upload their verified grade card and income declaration before December 5 to retain tuition fee waivers.',
        'Scholarships',
        'All Departments',
        'Office of Financial Aid',
        '2026-11-25 09:15:00',
      ],
    ];
    for (const [t, c, cat, dep, auth, pub] of seededNotices) {
      insertNotice.run(t, c, cat, dep, auth, pub);
    }
  }
}
