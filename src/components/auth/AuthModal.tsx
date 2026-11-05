import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.tsx';
import { UserRole } from '../../types/index.ts';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  KeyRound, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  Building2, 
  Zap,
  Eye,
  EyeOff
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, login, logout, register, requestPasswordRecovery, company } = useERP();
  
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'SIGNUP' | 'FORGOT'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('manager');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await login(email, password);
    setIsLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`Welcome back, ${res.session?.fullName}!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await register({
      fullName,
      email,
      password,
      role,
      companyId: company.id,
    });
    setIsLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setSuccessMsg(`Account created for ${res.user?.fullName}! You can now sign in.`);
      setActiveTab('LOGIN');
      setPassword('');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await requestPasswordRecovery(email);
    setIsLoading(false);

    if (res.success) {
      setSuccessMsg(res.message);
    } else {
      setErrorMsg(res.message);
    }
  };

  const quickLoginAs = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
    setIsLoading(true);
    const res = await login(demoEmail, demoPass);
    setIsLoading(false);
    if (!res.error) {
      setSuccessMsg(`Signed in as ${res.session?.fullName}`);
      setTimeout(() => onClose(), 800);
    } else {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Identity & Authentication</h2>
              <p className="text-[11px] text-slate-400">
                {company.companyName} · Role-Based Security
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => { setActiveTab('LOGIN'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'LOGIN'
                ? 'border-red-600 text-red-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setActiveTab('SIGNUP'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'SIGNUP'
                ? 'border-red-600 text-red-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Register Staff
          </button>
          <button
            onClick={() => { setActiveTab('FORGOT'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'FORGOT'
                ? 'border-red-600 text-red-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Password Help
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form 1: Sign In */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Corporate Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@yasoth.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full pl-9 pr-10 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-md shadow-red-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Authenticating...' : 'Sign In Securely'}</span>
              </button>

              {/* Demo Fast Login Buttons */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2 tracking-wider">
                  Quick Demo Accounts (Offline / Verification):
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => quickLoginAs('admin@yasoth.com', 'Admin@123')}
                    className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-red-50 hover:border-red-300 text-left cursor-pointer transition-all"
                  >
                    <span className="font-bold block text-slate-900">Owner Admin</span>
                    <span className="text-[10px] text-slate-500">Full Privileges</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLoginAs('manager@yasoth.com', 'Manager@123')}
                    className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-left cursor-pointer transition-all"
                  >
                    <span className="font-bold block text-slate-900">Yard Manager</span>
                    <span className="text-[10px] text-slate-500">Ops & Posting</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLoginAs('accounts@yasoth.com', 'Accounts@123')}
                    className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-purple-50 hover:border-purple-300 text-left cursor-pointer transition-all"
                  >
                    <span className="font-bold block text-slate-900">Accounts</span>
                    <span className="text-[10px] text-slate-500">Ledger & Vouchers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLoginAs('auditor@yasoth.com', 'Auditor@123')}
                    className="p-2 border border-slate-200 rounded-lg bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-left cursor-pointer transition-all"
                  >
                    <span className="font-bold block text-slate-900">Auditor</span>
                    <span className="text-[10px] text-slate-500">Strictly Read-Only</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Form 2: Register Staff */}
          {activeTab === 'SIGNUP' && (
            <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Legal Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Corporate Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. ramesh@yasoth.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Security Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full p-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500 bg-white"
                >
                  <option value="manager">Yard Manager</option>
                  <option value="purchase_operator">Purchase Operator</option>
                  <option value="weighment_operator">Weighment Operator</option>
                  <option value="sales_operator">Sales Operator</option>
                  <option value="accounts_operator">Accounts Operator</option>
                  <option value="store_operator">Store Operator</option>
                  <option value="hr_operator">HR / Attendance Operator</option>
                  <option value="auditor">Auditor (Read-Only)</option>
                  <option value="owner_admin">Owner / Administrator</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Create Secure Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                <span>{isLoading ? 'Creating Account...' : 'Register Employee Account'}</span>
              </button>
            </form>
          )}

          {/* Form 3: Forgot Password */}
          {activeTab === 'FORGOT' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <p className="text-slate-600">
                Enter your registered corporate email address. A cryptographic recovery token will be dispatched and registered in the security audit ledger.
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Corporate Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. admin@yasoth.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
              >
                {isLoading ? 'Processing Request...' : 'Send Password Recovery Instructions'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
