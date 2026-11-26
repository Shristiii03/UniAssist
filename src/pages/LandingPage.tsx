import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  FileText,
  MessageSquare,
  ShieldCheck,
  Mic,
  Volume2,
  Sun,
  Moon,
  Code2,
  Briefcase,
  Search,
} from 'lucide-react';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { CATEGORIZED_PROMPTS, DOCUMENT_CATEGORIES, type ChatMode } from '../types/index.ts';

const HERO_IMAGE = '/src/assets/images/hero_campus_library_1795713252870.jpg';
const HANDBOOK_IMAGE = '/src/assets/images/feature_document_rag_1795713252583.jpg';

export function LandingPage() {
  const { demoLogin, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [quickQuestion, setQuickQuestion] = useState('');
  const [activePromptTab, setActivePromptTab] = useState<ChatMode>('campus');
  const [launching, setLaunching] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [handbookImgFailed, setHandbookImgFailed] = useState(false);

  const launchChat = async (initialPrompt?: string, mode: ChatMode = 'all') => {
    try {
      setLaunching(true);
      if (!isAuthenticated) {
        await demoLogin();
      }
      navigate('/chat', {
        state: {
          ...(initialPrompt ? { initialPrompt } : {}),
          mode,
        },
      });
    } catch {
      navigate('/login');
    } finally {
      setLaunching(false);
    }
  };

  const handleHeroAsk = (e: FormEvent) => {
    e.preventDefault();
    const q = quickQuestion.trim();
    if (!q) {
      launchChat(undefined, 'all');
      return;
    }
    launchChat(q, 'all');
  };

  const currentPromptGroup =
    CATEGORIZED_PROMPTS.find((g) => g.mode === activePromptTab) ?? CATEGORIZED_PROMPTS[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-16 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wide mb-3">
                Smart Campus & Academic Assistant
              </p>

              <h1
                className="font-display font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.55rem)', textWrap: 'balance' }}
              >
                Your College. Your Questions. One AI Assistant.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mb-7">
                Ask anything—from attendance policies, exam schedules, and placement criteria cited
                directly from official college PDFs to coding help, study plans, and career advice.
              </p>

              {/* Live Interactive Quick-Ask Bar */}
              <form
                onSubmit={handleHeroAsk}
                className="mb-6 flex items-center gap-2 p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-sm focus-within:ring-2 focus-within:ring-blue-600"
              >
                <Search className="w-4 h-4 text-slate-400 ml-2.5 shrink-0" />
                <input
                  type="text"
                  value={quickQuestion}
                  onChange={(e) => setQuickQuestion(e.target.value)}
                  placeholder="Ask any campus, coding, or study question..."
                  className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 py-2 px-1 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={launching}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <span>{launching ? 'Opening...' : 'Ask AI'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => launchChat(undefined, 'all')}
                  disabled={launching}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open AI Chatbot</span>
                </button>

                <Link
                  to={isAuthenticated ? '/dashboard' : '/login'}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Student & Admin Sign In'}</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[300px] lg:min-h-[430px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900 relative">
                {!heroImgFailed ? (
                  <img
                    src={HERO_IMAGE}
                    alt="Sunlit university library and student academic commons"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-900 dark:to-indigo-950">
                    <BookOpen className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-3" />
                    <p className="font-display font-semibold text-slate-900 dark:text-white">
                      Central Campus Knowledge Commons
                    </p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-5 sm:p-6">
                  <p className="text-xs font-medium text-blue-200">
                    Document-Grounded RAG + Multi-Topic Academic AI
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    Instant page-cited policy lookups alongside everyday study, coding, and career support.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Proof Strip */}
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                All Topics
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Campus rules, STEM study, coding & career Q&A
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                10 Categories
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Official PDF handbooks & notices indexed
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                Page-Cited
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Campus answers link source PDFs & pages
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                24/7 Live
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Real-time streaming with voice & TTS
              </p>
            </div>
          </div>
        </section>

        {/* Features Asymmetric Bento Grid */}
        <section
          id="features"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-16 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                Platform Capabilities
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                One workspace for official campus handbooks and everyday academic help.
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Wide Lead Feature Card */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] overflow-hidden grid grid-cols-1 md:grid-cols-2">
                <div className="p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-4" />
                    <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">
                      Document-Grounded Campus RAG
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                      Upload university PDF handbooks, exam regulations, and fee circulars. The
                      assistant parses pages, indexes embeddings, and cites exact document names
                      and page numbers for every campus policy question.
                    </p>
                  </div>
                  <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
                    {DOCUMENT_CATEGORIES.slice(0, 5).join(' · ')}
                  </p>
                </div>

                <div className="min-h-[220px] bg-slate-200 dark:bg-slate-800">
                  {!handbookImgFailed ? (
                    <img
                      src={HANDBOOK_IMAGE}
                      alt="College academic handbooks and digital syllabus viewer"
                      referrerPolicy="no-referrer"
                      onError={() => setHandbookImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-6 text-slate-500">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>

              {/* Study & Coding AI Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <Code2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-4" />
                  <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-3">
                    Study, Coding & STEM Tutor
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    Get clear explanations for algorithms, calculus, lab concepts, essay outlines,
                    and exam revision schedules—formatted with clean Markdown tables and syntax
                    code blocks.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5" /> Voice Input
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" /> Read Aloud
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] p-6">
                <Briefcase className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-4" />
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Placement & Career Coaching
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Check campus CGPA eligibility and offer-tier policies alongside resume feedback,
                  mock interview prep, and project portfolio advice.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] p-6">
                <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-4" />
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Admin Document & Notice Console
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Authorized staff upload new PDF circulars, publish campus notices, curate FAQs,
                  and track question volume and helpfulness ratings.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] p-6">
                <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-4" />
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Department & Mode Controls
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Switch seamlessly between All Questions, strict Campus Policies, Study & Coding,
                  or Career Prep across every academic department.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-16 lg:py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
              Intelligent Routing & RAG Pipeline
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              How every student question gets the right answer fast.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-slate-200 dark:border-slate-800 pt-10">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                01. PDF Extraction & Vector Indexing
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Uploaded college PDFs are parsed page by page, chunked with overlap, and embedded
                alongside campus FAQs and official notices in SQLite.
              </p>
            </div>

            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                02. Context-Aware Retrieval
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Campus queries pull matching PDF excerpts and notices via hybrid semantic + keyword
                scoring, while academic and coding queries engage full subject reasoning.
              </p>
            </div>

            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                03. Streamed Cited Responses
              </h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Answers stream token-by-token with Markdown formatting, expandable document
                citations, voice playback, regeneration, and transcript export.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Question Explorer */}
        <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] py-16 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                  Built for Every Question Type
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Click any question to try the live assistant.
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 w-fit">
                {CATEGORIZED_PROMPTS.map((group) => (
                  <button
                    key={group.mode}
                    type="button"
                    onClick={() => setActivePromptTab(group.mode)}
                    className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      activePromptTab === group.mode
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {group.category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentPromptGroup.items.map((item) => (
                <button
                  key={item.prompt}
                  type="button"
                  onClick={() => launchChat(item.prompt, currentPromptGroup.mode)}
                  className="text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      {item.title}
                    </p>
                    <p className="text-sm sm:text-base font-medium text-slate-900 dark:text-white leading-snug">
                      {item.prompt}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span>Ask in Chatbot</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-[#F7F8FA] dark:bg-[#090D16] py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
              AI College Assistant
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Smart Campus Assistant · Grounded campus policies and all-topic student AI support.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
            <Link to="/chat" className="hover:text-blue-600 dark:hover:text-blue-400">
              AI Chatbot
            </Link>
            <Link to="/notices" className="hover:text-blue-600 dark:hover:text-blue-400">
              Notices & FAQs
            </Link>
            <Link to="/about" className="hover:text-blue-600 dark:hover:text-blue-400">
              About
            </Link>
            <a
              href="mailto:support@campus-assistant.edu"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Contact
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
