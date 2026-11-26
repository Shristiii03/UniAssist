import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  ArrowRight,
  FileText,
  Bell,
  Clock,
  BookOpen,
  Search,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import {
  CATEGORIZED_PROMPTS,
  type ChatMode,
  type Conversation,
  type DocumentItem,
  type NoticeItem,
} from '../types/index.ts';

export function StudentDashboard() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [quickPrompt, setQuickPrompt] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get<{ conversations: Conversation[] }>('/chat/history'),
      api.get<{ documents: DocumentItem[] }>('/documents'),
      api.get<{ notices: NoticeItem[] }>('/notices'),
    ])
      .then(([convRes, docRes, noticeRes]) => {
        if (!active) return;
        setConversations(convRes.data.conversations);
        setDocuments(docRes.data.documents);
        setNotices(noticeRes.data.notices);
      })
      .catch(() => {
        if (active) setError('Could not load dashboard data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const openChatWithPrompt = (prompt?: string, mode: ChatMode = 'all') => {
    navigate('/chat', {
      state: {
        ...(prompt ? { initialPrompt: prompt } : {}),
        mode,
      },
    });
  };

  const handleQuickSubmit = (e: FormEvent) => {
    e.preventDefault();
    openChatWithPrompt(quickPrompt.trim() || undefined, 'all');
  };

  return (
    <AppShell
      title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Student'}`}
      breadcrumb={`Workspace / ${user?.department ?? 'Campus'} / Overview`}
      rightActions={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              to="/admin"
              className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Admin Console
            </Link>
          )}
          <button
            type="button"
            onClick={() => openChatWithPrompt()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Chatbot</span>
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {error && (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Quick-Ask Command Bar + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                {user?.department} · Smart Campus & Study Assistant
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Ask any campus policy, coding, study, or placement question.
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl mb-5">
                Campus policy answers are grounded in {documents.length} indexed college PDFs with
                page citations, alongside full academic and career guidance.
              </p>
            </div>

            <form
              onSubmit={handleQuickSubmit}
              className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-600"
            >
              <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
              <input
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                placeholder="Type any question and press Enter..."
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 py-2 px-1 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Ask AI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Workspace Summary
            </p>
            <div className="grid grid-cols-2 gap-4 my-4">
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                  {loading ? '—' : conversations.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Conversations</p>
              </div>
              <div>
                <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                  {loading ? '—' : documents.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Indexed PDFs</p>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {notices.length} active notices
              </span>
              <Link
                to="/notices"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Notice Board
              </Link>
            </div>
          </div>
        </div>

        {/* Categorized Quick Prompts */}
        <section className="space-y-4">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Explore Questions Across Topics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CATEGORIZED_PROMPTS.map((group) => (
              <div
                key={group.mode}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3"
              >
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {group.category}
                </p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <button
                      key={item.prompt}
                      type="button"
                      onClick={() => openChatWithPrompt(item.prompt, group.mode)}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span>{item.prompt}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Conversations & Campus Notices */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Recent Conversations
              </h3>
              <Link
                to="/chat"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Chatbot
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No conversations yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  Use the search bar above or click any topic card to start chatting.
                </p>
                <button
                  type="button"
                  onClick={() => openChatWithPrompt()}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  Ask First Question
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {conversations.slice(0, 5).map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => navigate('/chat', { state: { conversationId: conv.id } })}
                    className="w-full py-3 text-left flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {conv.department} · {conv.message_count ?? 0} messages
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Latest Campus Notices
              </h3>
              <Link
                to="/notices"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                All Notices & FAQs
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : notices.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No active notices posted.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {notices.slice(0, 4).map((notice) => (
                  <div key={notice.id} className="py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {notice.category} · {notice.department} ·{' '}
                      <span className="tabular-nums">{notice.published_at.slice(0, 10)}</span>
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {notice.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {notice.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Indexed College Documents */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Indexed College Documents
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official handbooks and circulars searchable by the AI Assistant
              </p>
            </div>
            <BookOpen className="w-5 h-5 text-slate-400" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Document Name</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">Department</th>
                  <th className="py-2.5 px-4 font-medium text-right">Pages</th>
                  <th className="py-2.5 pl-4 font-medium text-right">Indexed Chunks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate max-w-xs">{doc.original_name}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{doc.category}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{doc.department}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {doc.page_count}
                    </td>
                    <td className="py-3 pl-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {doc.chunk_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
