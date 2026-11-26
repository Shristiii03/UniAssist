import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { DEPARTMENTS } from '../types/index.ts';

type AuthMode = 'login' | 'register' | 'admin';

export function AuthPage({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const { login, register, demoLogin, claimAdmin, passcodeAdminLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState<string>('Computer Science');
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [adminStatus, setAdminStatus] = useState<{ hasAdmin: boolean; envPasscodeConfigured: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (fromPath) {
        navigate(fromPath, { replace: true });
      } else {
        navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, fromPath, navigate]);

  useEffect(() => {
    api
      .get<{ hasAdmin: boolean; envPasscodeConfigured: boolean }>('/auth/admin-status')
      .then((res) => setAdminStatus(res.data))
      .catch(() => setAdminStatus({ hasAdmin: false, envPasscodeConfigured: false }));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const signedIn = await login(email, password);
        navigate(signedIn.role === 'admin' ? '/admin' : '/dashboard');
      } else if (mode === 'register') {
        await register({ name, email, password, department });
        navigate('/dashboard');
      } else if (mode === 'admin') {
        if (adminStatus?.envPasscodeConfigured) {
          await passcodeAdminLogin(passcode);
          navigate('/admin');
        } else if (!adminStatus?.hasAdmin) {
          await claimAdmin({ name, email, password });
          navigate('/admin');
        } else {
          const signedIn = await login(email, password);
          if (signedIn.role !== 'admin') {
            setError('This account is a student account, not an administrator.');
            return;
          }
          navigate('/admin');
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Authentication failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setLoading(true);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch {
      setError('Could not launch demo session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F19]">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {mode === 'login' && 'Sign in to Campus Assistant'}
              {mode === 'register' && 'Create your student account'}
              {mode === 'admin' && 'Administrator Portal'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {mode === 'login' && 'Access your saved conversations, notices, and AI chatbot.'}
              {mode === 'register' && 'Register with your college email to personalize department answers.'}
              {mode === 'admin' &&
                (!adminStatus?.hasAdmin && !adminStatus?.envPasscodeConfigured
                  ? 'First-run setup: claim the administrator account to manage PDFs and notices.'
                  : 'Sign in with administrator credentials to upload documents and manage FAQs.')}
            </p>
          </div>

          {/* Mode switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('admin');
                setError('');
              }}
              className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {(mode === 'register' ||
              (mode === 'admin' && !adminStatus?.hasAdmin && !adminStatus?.envPasscodeConfigured)) && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={mode === 'admin' ? 'Dr. Priya Nair' : 'Ananya Sharma'}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {mode === 'admin' && adminStatus?.envPasscodeConfigured ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Administrator Passcode
                </label>
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter server admin passcode"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    College Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={mode === 'admin' ? 'admin@campus.edu' : 'student@campus.edu'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={mode === 'login' ? 1 : 8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'login' ? 'Enter password' : 'Minimum 8 characters'}
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Academic Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DEPARTMENTS.filter((d) => d !== 'All Departments').map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {mode === 'admin' && <ShieldCheck className="w-4 h-4" />}
              <span>
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Student Account'
                  : !adminStatus?.hasAdmin && !adminStatus?.envPasscodeConfigured
                  ? 'Claim Admin Account'
                  : 'Sign In as Admin'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {mode !== 'admin' && (
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDemo}
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Continue as Demo Student
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
