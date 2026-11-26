import { useEffect, useState } from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';
import { Navbar } from '../components/Navbar.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { DOCUMENT_CATEGORIES, type FAQItem, type NoticeItem } from '../types/index.ts';

export function NoticesAndFaqsPage() {
  const { isAuthenticated } = useAuth();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ notices: NoticeItem[] }>('/notices'),
      api.get<{ faqs: FAQItem[] }>('/faqs'),
    ])
      .then(([nRes, fRes]) => {
        setNotices(nRes.data.notices);
        setFaqs(fRes.data.faqs);
      })
      .finally(() => setLoading(false));
  }, []);

  const matches = (text: string, cat: string) => {
    const catOk = category === 'All' || cat === category;
    const qOk = !search.trim() || text.toLowerCase().includes(search.trim().toLowerCase());
    return catOk && qOk;
  };

  const filteredNotices = notices.filter((n) =>
    matches(`${n.title} ${n.content}`, n.category)
  );
  const filteredFaqs = faqs.filter((f) =>
    matches(`${f.question} ${f.answer}`, f.category)
  );

  const content = (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
            Campus Announcements & Knowledge Directory
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Notice Board & Frequently Asked Questions
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notices or FAQs..."
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
          >
            <option value="All">All Categories</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notices */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Official Campus Notices
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center text-sm text-slate-500">
            No notices match your current search or category filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotices.map((notice) => (
              <article
                key={notice.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {notice.category} · {notice.department} ·{' '}
                  <span className="tabular-nums">{notice.published_at.slice(0, 10)}</span>
                </p>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-2">
                  {notice.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {notice.content}
                </p>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Issued by {notice.author_name}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* FAQs */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : filteredFaqs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 text-center text-sm text-slate-500">
            No FAQs match your current search or category filter.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] divide-y divide-slate-200 dark:divide-slate-800">
            {filteredFaqs.map((faq) => (
              <div key={faq.id} className="p-6">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  {faq.category} · {faq.department}
                </p>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white mb-2">
                  {faq.question}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  if (isAuthenticated) {
    return (
      <AppShell title="Notices & FAQs" breadcrumb="Workspace / Notices & FAQs">
        {content}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19]">
      <Navbar />
      {content}
    </div>
  );
}
