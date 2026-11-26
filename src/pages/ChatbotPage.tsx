import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Plus,
  Send,
  Search,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  PanelLeftOpen,
  X,
  Square,
  BookOpen,
  Code2,
  Briefcase,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { AppShell } from '../components/AppShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api, streamChatRequest } from '../services/api.ts';
import {
  CATEGORIZED_PROMPTS,
  DEPARTMENTS,
  type ChatMessage,
  type ChatMode,
  type Conversation,
  type SourceCitation,
} from '../types/index.ts';

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const MODE_OPTIONS: Array<{ id: ChatMode; label: string; hint: string; icon: typeof Sparkles }> = [
  { id: 'all', label: 'All Questions', hint: 'Campus docs + general academic & career help', icon: Sparkles },
  { id: 'campus', label: 'Campus Policies', hint: 'Strict handbook, notice & FAQ lookup', icon: BookOpen },
  { id: 'study', label: 'Study & Coding', hint: 'STEM, programming, essays & exam revision', icon: Code2 },
  { id: 'career', label: 'Career Prep', hint: 'Placements, resumes & interview coaching', icon: Briefcase },
];

export function ChatbotPage() {
  const { user, isAuthenticated, demoLogin } = useAuth();
  const location = useLocation();
  const routeState = location.state as {
    initialPrompt?: string;
    conversationId?: number;
    mode?: ChatMode;
  } | null;

  const [sessionReady, setSessionReady] = useState(isAuthenticated);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConvId, setActiveConvId] = useState<number | null>(routeState?.conversationId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [department, setDepartment] = useState<string>(user?.department || 'All Departments');
  const [mode, setMode] = useState<ChatMode>(routeState?.mode ?? 'all');

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingSources, setStreamingSources] = useState<SourceCitation[]>([]);
  const [error, setError] = useState('');

  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedSourcesId, setExpandedSourcesId] = useState<number | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const initialPromptHandledRef = useRef(false);

  // Ensure visitor gets a real signed session automatically if visiting /chat directly
  useEffect(() => {
    let active = true;
    if (isAuthenticated) {
      setSessionReady(true);
      return;
    }
    demoLogin()
      .then(() => {
        if (active) setSessionReady(true);
      })
      .catch(() => {
        if (active) setError('Could not initialize chat session. Please sign in.');
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, demoLogin]);

  const fetchHistory = async (q = '') => {
    if (!sessionReady) return;
    try {
      const res = await api.get<{ conversations: Conversation[] }>('/chat/history', {
        params: q ? { q } : undefined,
      });
      setConversations(res.data.conversations);
    } catch {
      // ignore transient list error
    }
  };

  const loadConversation = async (convId: number) => {
    try {
      setError('');
      const res = await api.get<{ conversation: Conversation; messages: ChatMessage[] }>(
        `/chat/${convId}`
      );
      setActiveConvId(convId);
      setMessages(res.data.messages);
      setDepartment(res.data.conversation.department || 'All Departments');
      setHistoryOpen(false);
    } catch {
      setError('Could not load selected conversation.');
    }
  };

  useEffect(() => {
    if (sessionReady) {
      fetchHistory(searchQuery);
    }
  }, [sessionReady, searchQuery]);

  useEffect(() => {
    if (sessionReady && routeState?.conversationId) {
      loadConversation(routeState.conversationId);
    }
  }, [sessionReady, routeState?.conversationId]);

  useEffect(() => {
    if (sessionReady && routeState?.initialPrompt && !initialPromptHandledRef.current) {
      initialPromptHandledRef.current = true;
      sendMessage(routeState.initialPrompt, false, routeState.mode ?? 'all');
    }
  }, [sessionReady, routeState?.initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current?.stop();
    };
  }, []);

  const startNewConversation = () => {
    if (streaming) return;
    setActiveConvId(null);
    setMessages([]);
    setStreamingText('');
    setStreamingSources([]);
    setError('');
    setHistoryOpen(false);
  };

  const deleteConversation = async (convId: number) => {
    try {
      await api.delete(`/chat/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        startNewConversation();
      }
    } catch {
      setError('Failed to delete conversation.');
    }
  };

  const stopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (streamingText.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          conversation_id: activeConvId ?? 0,
          sender: 'assistant',
          message: streamingText,
          sources: streamingSources,
          feedback: null,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setStreaming(false);
    setStreamingText('');
    setStreamingSources([]);
  };

  const sendMessage = async (
    overrideText?: string,
    regenerate = false,
    overrideMode?: ChatMode
  ) => {
    if (!sessionReady) return;
    const textToSend = (overrideText ?? input).trim();
    const activeMode = overrideMode ?? mode;
    if (!regenerate && !textToSend) return;
    if (streaming) return;

    setError('');
    if (!regenerate) {
      setInput('');
      const optimisticUserMsg: ChatMessage = {
        id: Date.now(),
        conversation_id: activeConvId ?? 0,
        sender: 'user',
        message: textToSend,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);
    } else {
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length > 0 && copy[copy.length - 1].sender === 'assistant') {
          copy.pop();
        }
        return copy;
      });
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStreaming(true);
    setStreamingText('');
    setStreamingSources([]);

    let accumulated = '';
    let resolvedConvId = activeConvId;

    await streamChatRequest(
      {
        message: regenerate ? undefined : textToSend,
        conversationId: activeConvId,
        department,
        regenerate,
        mode: activeMode,
      },
      {
        onMeta: (meta) => {
          resolvedConvId = meta.conversationId;
          setActiveConvId(meta.conversationId);
          setStreamingSources(meta.sources || []);
        },
        onToken: (token) => {
          accumulated += token;
          setStreamingText(accumulated);
        },
        onDone: (done) => {
          const finalMsg: ChatMessage = {
            id: done.assistantMessageId,
            conversation_id: done.conversationId,
            sender: 'assistant',
            message: accumulated || 'I could not generate a response. Please try again.',
            sources: done.sources || [],
            feedback: null,
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, finalMsg]);
          setStreamingText('');
          setStreamingSources([]);
          setStreaming(false);
          abortControllerRef.current = null;
          fetchHistory(searchQuery);
        },
        onError: (errMsg) => {
          setError(errMsg);
          setStreaming(false);
          setStreamingText('');
          abortControllerRef.current = null;
          if (resolvedConvId) {
            fetchHistory(searchQuery);
          }
        },
      },
      controller.signal
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCopy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard error
    }
  };

  const handleFeedback = async (messageId: number, value: 'up' | 'down') => {
    const current = messages.find((m) => m.id === messageId)?.feedback;
    const nextValue = current === value ? null : value;
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: nextValue } : m))
    );
    try {
      await api.post(`/chat/messages/${messageId}/feedback`, { feedback: nextValue });
    } catch {
      // ignore transient feedback save issue
    }
  };

  const handleSpeak = (id: number, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('Text-to-speech is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }
    const cleanText = text.replace(/\[([^\]]+)\]/g, '$1').replace(/[#*`_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    const SpeechRec =
      (window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      setError('Voice input requires a browser supporting Web Speech Recognition.');
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const exportTranscript = () => {
    if (messages.length === 0) return;
    const lines = [
      `# AI College Assistant Transcript`,
      `Mode: ${mode} | Department: ${department}`,
      `Exported: ${new Date().toLocaleString()}`,
      '',
      ...messages.map((m) => {
        const who = m.sender === 'user' ? 'Student' : 'AI College Assistant';
        const cites =
          m.sources && m.sources.length > 0
            ? `\nSources: ${m.sources.map((s) => `${s.filename} (p. ${s.pageNumber})`).join(', ')}`
            : '';
        return `### ${who}\n${m.message}${cites}\n`;
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-assistant-chat-${activeConvId ?? 'draft'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeModeObj = MODE_OPTIONS.find((m) => m.id === mode) ?? MODE_OPTIONS[0];

  const historySidebarBody = (
    <div className="flex flex-col h-full bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800">
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewConversation}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close chat history"
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8 px-3">
            {searchQuery ? 'No matching conversations found.' : 'Your conversations will appear here.'}
          </p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeConvId === conv.id
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => loadConversation(conv.id)}
                className="flex-1 text-left truncate cursor-pointer py-0.5"
              >
                {conv.title}
              </button>
              <button
                type="button"
                onClick={() => deleteConversation(conv.id)}
                aria-label="Delete conversation"
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-opacity cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {user?.email === 'student.demo@campus.edu' && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1.5">
            Chatting in Demo Guest session.
          </p>
          <Link
            to="/login"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Sign in with your college email
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <AppShell
      title="AI College Chatbot"
      breadcrumb={`Workspace / AI Chatbot · ${activeModeObj.label}`}
      rightActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <select
            aria-label="Filter by department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="hidden sm:block px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={exportTranscript}
                title="Export transcript as Markdown"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeConvId) deleteConversation(activeConvId);
                  else startNewConversation();
                }}
                title="Clear conversation"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="flex h-[calc(100vh-4rem)] relative">
        {/* Desktop Chat History Sidebar */}
        <aside className="hidden lg:block w-68 shrink-0 h-full">{historySidebarBody}</aside>

        {/* Mobile History Drawer */}
        {historyOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-950/50" onClick={() => setHistoryOpen(false)} />
            <div className="relative w-72 max-w-[85vw] h-full z-10">{historySidebarBody}</div>
          </div>
        )}

        {/* Chat Thread & Composer */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F7F8FA] dark:bg-[#090D16]">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {!sessionReady ? (
                <div className="py-20 flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span>Preparing your AI workspace...</span>
                </div>
              ) : messages.length === 0 && !streaming ? (
                <div className="py-6 sm:py-10 space-y-8">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      Ask anything — campus rules, coding, study help, or career prep
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      College policy questions automatically pull page-cited excerpts from uploaded
                      PDFs, FAQs, and notices.
                    </p>
                  </div>

                  {/* Categorized Empty State Prompt Grid */}
                  <div className="space-y-5">
                    {CATEGORIZED_PROMPTS.map((group) => (
                      <div key={group.mode}>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                          {group.category}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {group.items.map((item) => (
                            <button
                              key={item.prompt}
                              type="button"
                              onClick={() => {
                                setMode(group.mode);
                                sendMessage(item.prompt, false, group.mode);
                              }}
                              className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
                            >
                              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                {item.title}
                              </p>
                              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-snug">
                                {item.prompt}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isUser = msg.sender === 'user';
                  const isLastAssistant = !isUser && idx === messages.length - 1 && !streaming;

                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`${
                          isUser
                            ? 'max-w-[85%] sm:max-w-[75%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm shadow-sm'
                            : 'w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-sm px-5 py-4 text-sm'
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        ) : (
                          <>
                            <div className="chat-markdown leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.message}
                              </ReactMarkdown>
                            </div>

                            {/* Compact Source Citations */}
                            {msg.sources && msg.sources.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedSourcesId(
                                      expandedSourcesId === msg.id ? null : msg.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>
                                    {msg.sources.length} official document reference
                                    {msg.sources.length > 1 ? 's' : ''}
                                  </span>
                                  {expandedSourcesId === msg.id ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {expandedSourcesId === msg.id && (
                                  <div className="mt-2.5 space-y-2">
                                    {msg.sources.map((src, sIdx) => (
                                      <div
                                        key={`${src.documentId}-${src.pageNumber}-${sIdx}`}
                                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                                      >
                                        <p className="font-mono font-medium text-slate-900 dark:text-white">
                                          {src.filename} · Page {src.pageNumber} · {src.category}
                                        </p>
                                        <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                                          {src.excerpt}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Message Actions */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.id, msg.message)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {copiedId === msg.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSpeak(msg.id, msg.message)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                {speakingId === msg.id ? (
                                  <>
                                    <VolumeX className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Stop</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>Listen</span>
                                  </>
                                )}
                              </button>

                              {isLastAssistant && (
                                <button
                                  type="button"
                                  onClick={() => sendMessage(undefined, true)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Regenerate</span>
                                </button>
                              )}

                              <div className="ml-auto flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Helpful response"
                                  onClick={() => handleFeedback(msg.id, 'up')}
                                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                                    msg.feedback === 'up'
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : ''
                                  }`}
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Not helpful response"
                                  onClick={() => handleFeedback(msg.id, 'down')}
                                  className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                                    msg.feedback === 'down'
                                      ? 'text-red-600 dark:text-red-400'
                                      : ''
                                  }`}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Live Streaming Bubble */}
              {streaming && (
                <div className="flex justify-start">
                  <div className="w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 text-sm">
                    {streamingText ? (
                      <div className="chat-markdown leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {streamingText}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:120ms]" />
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:240ms]" />
                        <span className="ml-1">Thinking and checking campus context...</span>
                      </div>
                    )}

                    {streamingSources.length > 0 && (
                      <p className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Matched: {streamingSources.map((s) => `${s.filename} (p.${s.pageNumber})`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
                  <span>{error}</span>
                  {messages.length > 0 && !streaming && (
                    <button
                      type="button"
                      onClick={() => sendMessage(undefined, true)}
                      className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700 cursor-pointer shrink-0"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Mode Selector + Composer */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 sm:px-6 lg:px-10 py-3">
            <div className="max-w-3xl mx-auto space-y-2.5">
              {/* Mode Selector Strip */}
              <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {MODE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.hint}
                        onClick={() => setMode(opt.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          mode === opt.id
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="hidden md:inline text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {activeModeObj.hint}
                </span>
              </div>

              {/* Message Input */}
              <div className="flex items-end gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2 focus-within:ring-2 focus-within:ring-blue-600">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  title={listening ? 'Stop voice input' : 'Speak your question'}
                  aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                  className={`p-2 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    listening
                      ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                      : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask in ${activeModeObj.label} mode... (Enter to send)`}
                  className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none py-2 px-1 focus:outline-none max-h-36"
                />

                {streaming ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    aria-label="Stop generating"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors cursor-pointer shrink-0"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    disabled={!sessionReady || !input.trim()}
                    aria-label="Send message"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
