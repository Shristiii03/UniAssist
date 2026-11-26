import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Navbar } from '../components/Navbar.tsx';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';

const QUAD_IMAGE = '/src/assets/images/about_campus_quad_1795713251639.jpg';

export function AboutPage() {
  const { isAuthenticated } = useAuth();
  const [imgFailed, setImgFailed] = useState(false);

  const body = (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      <div className="space-y-4">
        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
          About the Project
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white max-w-3xl">
          Transparent, citation-backed campus answers for every student.
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
          AI College Assistant was built to eliminate the friction of searching through scattered
          academic circulars, examination handbooks, hostel rules, and placement brochures.
          Instead of relying on unverified answers, every response is grounded directly in official
          PDF documents uploaded by campus administrators.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 h-64 sm:h-80 bg-slate-200 dark:bg-slate-900">
        {!imgFailed ? (
          <img
            src={QUAD_IMAGE}
            alt="Modern university campus quadrangle in morning sunlight"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            <BookOpen className="w-8 h-8" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Project Objectives
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>· Provide 24/7 instant student support across 10 campus policy categories.</li>
            <li>· Prevent hallucinated policies with strict Retrieval-Augmented Generation.</li>
            <li>· Surface exact source PDF filenames and page numbers for student verification.</li>
            <li>· Empower college staff to update circulars in seconds via the Admin Console.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-3">
            Architecture & Technology
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>· Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, Lucide Icons.</li>
            <li>· Backend: Express API server with scrypt auth, Multer PDF validation, and SSE streaming.</li>
            <li>· RAG Engine: Page-level PDF extraction, vector embeddings, and hybrid cosine retrieval.</li>
            <li>· Persistence: Relational SQLite storage for users, documents, chunks, conversations, and FAQs.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Ready to explore the assistant?
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Open your dashboard or ask a question against our indexed college handbooks.
          </p>
        </div>
        <Link
          to={isAuthenticated ? '/chat' : '/login'}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
        >
          <span>{isAuthenticated ? 'Open AI Chatbot' : 'Get Started'}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );

  if (isAuthenticated) {
    return (
      <AppShell title="About AI College Assistant" breadcrumb="Workspace / About">
        {body}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19]">
      <Navbar />
      {body}
    </div>
  );
}
