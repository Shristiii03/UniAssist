export type UserRole = 'student' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  filename: string;
  original_name: string;
  category: string;
  department: string;
  page_count: number;
  chunk_count: number;
  upload_date: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  uploaded_by_name?: string | null;
}

export interface SourceCitation {
  documentId: number;
  filename: string;
  category: string;
  pageNumber: number;
  excerpt: string;
  score: number;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender: 'user' | 'assistant';
  message: string;
  sources?: SourceCitation[];
  feedback?: 'up' | 'down' | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  department: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  department: string;
  created_at: string;
}

export interface NoticeItem {
  id: number;
  title: string;
  content: string;
  category: string;
  department: string;
  author_name: string;
  published_at: string;
}

export interface AdminDashboardData {
  summary: {
    totalDocuments: number;
    totalChunks: number;
    totalUsers: number;
    totalConversations: number;
    totalMessages: number;
    totalFaqs: number;
  };
  recentDocuments: DocumentItem[];
}

export interface AdminStatisticsData {
  categoryBreakdown: Array<{ category: string; count: number; chunks: number }>;
  departmentConversations: Array<{ department: string; count: number }>;
  feedbackStats: {
    positive: number | null;
    negative: number | null;
    totalAssistantMessages: number;
  };
  recentQuestions: Array<{ message: string; department: string; created_at: string }>;
}

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

export type ChatMode = 'all' | 'campus' | 'study' | 'career';

export const SUGGESTED_PROMPTS = [
  'What is the attendance requirement?',
  'When are semester examinations?',
  'Explain the grading system.',
  'What are the placement eligibility criteria?',
  'What documents are required for admission?',
  'What is the procedure for applying for leave?',
] as const;

export const CATEGORIZED_PROMPTS: Array<{
  mode: ChatMode;
  category: string;
  items: Array<{ title: string; prompt: string }>;
}> = [
  {
    mode: 'campus',
    category: 'Campus Rules & Policies',
    items: [
      {
        title: 'Attendance & Medical Condonation',
        prompt: 'What is the attendance requirement and medical condonation policy?',
      },
      {
        title: '10-Point Grading & Passing Criteria',
        prompt: 'Explain the grading system and minimum passing marks.',
      },
      {
        title: 'Admission Documents Checklist',
        prompt: 'What documents are required for admission?',
      },
    ],
  },
  {
    mode: 'study',
    category: 'Study, Coding & Exam Prep',
    items: [
      {
        title: 'Data Structures & Code Help',
        prompt: 'Explain binary search trees vs hash tables with clean Python examples.',
      },
      {
        title: 'Semester Exam Study Plan',
        prompt: 'Create a focused 5-day revision schedule for Database Management Systems.',
      },
      {
        title: 'Math & Engineering Concepts',
        prompt: 'Explain eigenvalues and eigenvectors intuitively with an example.',
      },
    ],
  },
  {
    mode: 'career',
    category: 'Placements & Career Readiness',
    items: [
      {
        title: 'Campus Placement Eligibility',
        prompt: 'What are the placement eligibility criteria and offer tier rules?',
      },
      {
        title: 'Technical Resume & Interview Prep',
        prompt: 'How should a final-year student structure a software engineering resume?',
      },
      {
        title: 'Leave & Internship Duty Process',
        prompt: 'What is the procedure for applying for academic duty or medical leave?',
      },
    ],
  },
];

