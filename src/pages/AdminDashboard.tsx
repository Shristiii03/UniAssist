import { useEffect, useState, type FormEvent } from 'react';
import {
  Upload,
  Trash2,
  FileText,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3,
  HelpCircle,
  Bell,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { api } from '../services/api.ts';
import {
  DOCUMENT_CATEGORIES,
  DEPARTMENTS,
  type AdminDashboardData,
  type AdminStatisticsData,
  type DocumentItem,
  type FAQItem,
  type NoticeItem,
} from '../types/index.ts';

type AdminTab = 'documents' | 'faqs' | 'notices' | 'analytics';

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('documents');
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [stats, setStats] = useState<AdminStatisticsData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>('Academics');
  const [uploadDepartment, setUploadDepartment] = useState<string>('All Departments');
  const [uploading, setUploading] = useState(false);

  // FAQ form state
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState<string>('Academics');
  const [faqDepartment, setFaqDepartment] = useState<string>('All Departments');

  // Notice form state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<string>('General Information');
  const [noticeDepartment, setNoticeDepartment] = useState<string>('All Departments');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadAll = async () => {
    try {
      setLoading(true);
      const [dashRes, statRes, docRes, faqRes, noticeRes] = await Promise.all([
        api.get<AdminDashboardData>('/admin/dashboard'),
        api.get<AdminStatisticsData>('/admin/statistics'),
        api.get<{ documents: DocumentItem[] }>('/documents'),
        api.get<{ faqs: FAQItem[] }>('/faqs'),
        api.get<{ notices: NoticeItem[] }>('/notices'),
      ]);
      setDashboard(dashRes.data);
      setStats(statRes.data);
      setDocuments(docRes.data.documents);
      setFaqs(faqRes.data.faqs);
      setNotices(noticeRes.data.notices);
    } catch {
      setError('Could not load administrator data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please choose a PDF file to upload.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', uploadCategory);
      formData.append('department', uploadDepartment);

      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSelectedFile(null);
      const fileInput = document.getElementById('pdf-file-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      setSuccessMsg('PDF extracted, chunked, and indexed into the knowledge base.');
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to upload PDF document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    setError('');
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSuccessMsg('Document removed from knowledge base.');
      await loadAll();
    } catch {
      setError('Could not delete document.');
    }
  };

  const handleAddFaq = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post<{ faq: FAQItem }>('/faqs', {
        question: faqQuestion,
        answer: faqAnswer,
        category: faqCategory,
        department: faqDepartment,
      });
      setFaqs((prev) => [res.data.faq, ...prev]);
      setFaqQuestion('');
      setFaqAnswer('');
      setSuccessMsg('FAQ published.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not add FAQ.');
    }
  };

  const handleDeleteFaq = async (id: number) => {
    try {
      await api.delete(`/faqs/${id}`);
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Could not delete FAQ.');
    }
  };

  const handleAddNotice = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post<{ notice: NoticeItem }>('/notices', {
        title: noticeTitle,
        content: noticeContent,
        category: noticeCategory,
        department: noticeDepartment,
      });
      setNotices((prev) => [res.data.notice, ...prev]);
      setNoticeTitle('');
      setNoticeContent('');
      setSuccessMsg('Campus notice published.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not publish notice.');
    }
  };

  const handleDeleteNotice = async (id: number) => {
    try {
      await api.delete(`/notices/${id}`);
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError('Could not delete notice.');
    }
  };

  const filteredDocs =
    categoryFilter === 'All'
      ? documents
      : documents.filter((d) => d.category === categoryFilter);

  const posCount = Number(stats?.feedbackStats?.positive ?? 0);
  const negCount = Number(stats?.feedbackStats?.negative ?? 0);
  const totalRated = posCount + negCount;
  const positiveRate = totalRated > 0 ? Math.round((posCount / totalRated) * 100) : 100;

  return (
    <AppShell
      title="Admin Console"
      breadcrumb="Workspace / Administration / Knowledge & Analytics"
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* KPI Overview Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">PDF Documents</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {loading ? '—' : dashboard?.summary.totalDocuments ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Indexed Chunks</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {loading ? '—' : dashboard?.summary.totalChunks ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Students</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {loading ? '—' : dashboard?.summary.totalUsers ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Conversations</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {loading ? '—' : dashboard?.summary.totalConversations ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Student Queries</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {loading ? '—' : dashboard?.summary.totalMessages ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Helpful Rate</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {loading ? '—' : `${positiveRate}%`}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
          {(
            [
              { id: 'documents', label: 'PDF Documents', icon: FileText },
              { id: 'faqs', label: 'Manage FAQs', icon: HelpCircle },
              { id: 'notices', label: 'Notice Board', icon: Bell },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setError('');
                  setSuccessMsg('');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === item.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB: DOCUMENTS */}
        {tab === 'documents' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Upload Form */}
            <form
              onSubmit={handleUpload}
              className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4 h-fit"
            >
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Upload College PDF
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Text is extracted page-by-page, chunked, and embedded for RAG retrieval (max 10 MB).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select PDF File
                </label>
                <input
                  id="pdf-file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-950/60 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Department Scope
                </label>
                <select
                  value={uploadDepartment}
                  onChange={(e) => setUploadDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing & Indexing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Index PDF</span>
                  </>
                )}
              </button>
            </form>

            {/* Documents Table */}
            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Knowledge Base Documents
                </h2>
                <select
                  aria-label="Filter documents by category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <option value="All">All Categories</option>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {filteredDocs.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  No documents match this category filter.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        <th className="py-2.5 pr-3 font-medium">File</th>
                        <th className="py-2.5 px-3 font-medium">Category</th>
                        <th className="py-2.5 px-3 font-medium">Status</th>
                        <th className="py-2.5 px-3 font-medium text-right">Chunks</th>
                        <th className="py-2.5 pl-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 pr-3">
                            <p className="font-medium text-slate-900 dark:text-white truncate max-w-[220px]">
                              {doc.original_name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {doc.department} · <span className="tabular-nums">{doc.page_count}p</span>
                            </p>
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                            {doc.category}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium ${
                                doc.processing_status === 'completed'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : doc.processing_status === 'failed'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {doc.processing_status === 'completed' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {doc.processing_status.charAt(0).toUpperCase() +
                                  doc.processing_status.slice(1)}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {doc.chunk_count}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              aria-label={`Delete ${doc.original_name}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: FAQS */}
        {tab === 'faqs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddFaq}
              className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4 h-fit"
            >
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Add New FAQ
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Question
                </label>
                <input
                  type="text"
                  required
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="e.g., How do I apply for a bonafide certificate?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Verified Answer
                </label>
                <textarea
                  rows={4}
                  required
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="Provide the official answer..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={faqCategory}
                    onChange={(e) => setFaqCategory(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Department
                  </label>
                  <select
                    value={faqDepartment}
                    onChange={(e) => setFaqDepartment(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Publish FAQ</span>
              </button>
            </form>

            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Published FAQs ({faqs.length})
              </h2>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {faqs.map((faq) => (
                  <div key={faq.id} className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {faq.category} · {faq.department}
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {faq.question}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {faq.answer}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteFaq(faq.id)}
                      aria-label="Delete FAQ"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: NOTICES */}
        {tab === 'notices' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleAddNotice}
              className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4 h-fit"
            >
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Publish Campus Notice
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notice Title
                </label>
                <input
                  type="text"
                  required
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder="e.g., Library Extended Exam Hours"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Announcement Details
                </label>
                <textarea
                  rows={4}
                  required
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  placeholder="Enter full circular details..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={noticeCategory}
                    onChange={(e) => setNoticeCategory(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Department
                  </label>
                  <select
                    value={noticeDepartment}
                    onChange={(e) => setNoticeDepartment(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Post Notice</span>
              </button>
            </form>

            <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Active Notice Board ({notices.length})
              </h2>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {notices.map((notice) => (
                  <div key={notice.id} className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {notice.category} · {notice.department} ·{' '}
                        <span className="tabular-nums">{notice.published_at.slice(0, 10)}</span>
                      </p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {notice.title}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {notice.content}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotice(notice.id)}
                      aria-label="Delete notice"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANALYTICS */}
        {tab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
                Documents by Category
              </h2>
              <div className="space-y-3">
                {stats?.categoryBreakdown.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="text-slate-800 dark:text-slate-200">{item.category}</span>
                    <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                      {item.count} PDFs · {item.chunks} chunks
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-4">
                Recent Student Queries
              </h2>
              {stats?.recentQuestions && stats.recentQuestions.length > 0 ? (
                <div className="space-y-3">
                  {stats.recentQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <p className="text-sm text-slate-900 dark:text-white">{q.message}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {q.department} · {q.created_at}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No student questions recorded yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
