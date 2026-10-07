import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDelivery } from '../../context/DeliveryContext';
import { UserRole } from '../../types';
import { AddressAutocompleteInput } from '../common/AddressAutocompleteInput';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  ShieldCheck,
  ChefHat,
  Bike,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  Utensils,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    login,
    register,
    sendVerification,
    forgotPassword,
    resetPassword,
    intendedPortal,
    setIntendedPortal
  } = useAuth();

  const { setActiveRole, setActivePage } = useDelivery();
  
  // Tab states: 'login' | 'register' | 'forgot'
  const [tab, setTab] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState<UserRole>('customer');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verification & Forgot Password OTP States
  const [signupCode, setSignupCode] = useState('');
  const [isVerificationCodeSent, setIsVerificationCodeSent] = useState(false);
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [isForgotCodeSent, setIsForgotCodeSent] = useState(false);

  // Reset fields to totally blank whenever the modal opens or tab toggles
  useEffect(() => {
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setAddress('');
    setError(null);
    setResetSuccessMsg(null);
    setSignupCode('');
    setIsVerificationCodeSent(false);
    setForgotCode('');
    setForgotNewPassword('');
    setIsForgotCodeSent(false);
  }, [tab, isAuthModalOpen]);

  // Focus modal context when opening portals
  useEffect(() => {
    if (intendedPortal) {
      if (intendedPortal === 'admin' || intendedPortal === 'sub_admin') {
        setRole('customer');
      } else {
        setRole(intendedPortal);
      }
      setTab('login');
    }
  }, [intendedPortal]);

  if (!isAuthModalOpen) return null;

  const handleClose = () => {
    setIsAuthModalOpen(false);
    setIntendedPortal(null);
    setError(null);
    setResetSuccessMsg(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccessMsg(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid registered email address');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.success) {
        setIsForgotCodeSent(true);
        if ((res as any)?.emailSent) {
          setResetSuccessMsg(`Recovery 6-digit OTP code has been sent directly to your email inbox at ${email}. Please check your inbox and spam folder!`);
        } else if ((res as any)?.devCode) {
          const code = (res as any).devCode;
          setForgotCode(code);
          setResetSuccessMsg(`Recovery code generated for ${email}. (Dev Code: ${code})`);
        } else {
          setResetSuccessMsg(`Recovery 6-digit OTP code has been sent to ${email}. Please check your email.`);
        }
      } else {
        setError(res.error || 'Failed to send recovery OTP code.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccessMsg(null);

    if (!forgotCode || forgotCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP code.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(email, forgotCode, forgotNewPassword);
      if (res.success) {
        setResetSuccessMsg('Your password has been successfully reset! Please sign in using your new password.');
        setIsForgotCodeSent(false);
        setTab('login');
      } else {
        setError(res.error || 'Failed to reset password. Please check your OTP code.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await login(email, password);
        if (res.success) {
          const loggedInUserRole = res.user?.role;
          if (intendedPortal) {
            setActiveRole(intendedPortal);
            setActivePage('home');
          } else if (loggedInUserRole && ['admin', 'sub_admin', 'restaurant', 'courier'].includes(loggedInUserRole)) {
            setActiveRole(loggedInUserRole === 'sub_admin' ? 'admin' : (loggedInUserRole as any));
            setActivePage('home');
          } else {
            setActiveRole('customer');
            setActivePage('home');
          }
          handleClose();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setError(res.error || 'Invalid email or password');
        }
      } else if (tab === 'register') {
        if (!agreeTerms) {
          setError('You must accept the Terms of Service to create an account');
          setLoading(false);
          return;
        }

        // If verification code has NOT been sent yet:
        if (!isVerificationCodeSent) {
          const res = await sendVerification(email);
          if (res.success) {
            setIsVerificationCodeSent(true);
            if ((res as any)?.emailSent) {
              setResetSuccessMsg(`A 6-digit verification code has been sent directly to your email inbox at ${email}. Please check your inbox and spam folder!`);
            } else if ((res as any)?.devCode) {
              const code = (res as any).devCode;
              setSignupCode(code);
              setResetSuccessMsg(`Verification code generated for ${email}. (Dev Code: ${code})`);
            } else {
              setResetSuccessMsg(`A 6-digit verification code has been sent to your email address: ${email}. Please enter it below!`);
            }
          } else {
            setError(res.error || 'Failed to send verification code.');
          }
          setLoading(false);
          return;
        }

        // Verify with code!
        if (!signupCode || signupCode.length !== 6) {
          setError('Please enter the 6-digit verification code sent to your email.');
          setLoading(false);
          return;
        }

        const res = await register({
          email,
          password,
          name: name.trim() || email.split('@')[0],
          role,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          code: signupCode
        });

        if (res.success) {
          if (res.pendingApproval) {
            setResetSuccessMsg(res.message || 'Registration submitted! Pending Super Admin approval.');
            setTab('login');
          } else {
            setActiveRole(role);
            setActivePage('home');
            handleClose();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          setError(res.error || 'Registration failed. Please make sure your code is correct.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  // Simple password strength calculator
  const getPasswordStrength = (pass: string) => {
    if (pass.length < 4) return { label: 'Too Weak', color: 'bg-rose-500', width: 'w-1/4' };
    if (pass.length < 7) return { label: 'Medium', color: 'bg-amber-500', width: 'w-2/4' };
    return { label: 'Strong', color: 'bg-emerald-500', width: 'w-full' };
  };

  const passStrength = getPasswordStrength(password);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 font-sans">
        
        {/* Top Decorative Brand Accent Line */}
        <div className="h-1.5 bg-gradient-to-r from-[#FF5500] via-[#FF7700] to-[#103E27]" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF1E8] border border-orange-200 text-[#FF5500] flex items-center justify-center shrink-0 shadow-2xs">
              {tab === 'forgot' ? (
                <KeyRound className="w-6 h-6 stroke-[2]" />
              ) : intendedPortal === 'restaurant' ? (
                <ChefHat className="w-6 h-6 stroke-[2]" />
              ) : intendedPortal === 'courier' ? (
                <Bike className="w-6 h-6 stroke-[2]" />
              ) : intendedPortal === 'admin' ? (
                <ShieldAlert className="w-6 h-6 stroke-[2]" />
              ) : (
                <Utensils className="w-6 h-6 stroke-[2]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900 font-display">
                  {tab === 'forgot'
                    ? 'Reset Your Password'
                    : intendedPortal
                    ? 'Portal Authentication'
                    : 'Welcome to Veyrang'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {tab === 'forgot'
                  ? 'Enter your email to receive a password reset link'
                  : intendedPortal
                  ? `Sign in with your ${intendedPortal} credentials`
                  : 'Sign in to place orders, track dispatches & access your wallet'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle (Sign In vs Create Account) - Hide when in Forgotten Password mode */}
        {tab !== 'forgot' && (
          <div className="p-1.5 mx-6 mt-5 bg-slate-100 rounded-2xl flex items-center border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
                setResetSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                tab === 'login'
                  ? 'bg-[#FF5500] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError(null);
                setResetSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                tab === 'register'
                  ? 'bg-[#FF5500] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form Body: Forgot Password View */}
        {tab === 'forgot' ? (
          <form onSubmit={isForgotCodeSent ? handleResetPasswordSubmit : handleForgotPassword} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {resetSuccessMsg && !isForgotCodeSent ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Reset Link Sent Successfully</span>
                </div>
                <p className="text-slate-600 leading-relaxed">{resetSuccessMsg}</p>
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setResetSuccessMsg(null);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            ) : isForgotCodeSent ? (
              // Reset Password screen (OTP + New Password)
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-orange-850 text-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-orange-700">
                    <KeyRound className="w-4 h-4 text-orange-600" />
                    <span>Enter OTP to Reset Password</span>
                  </div>
                  <p className="text-slate-600">
                    We've sent a 6-digit password recovery code to <strong>{email}</strong>. Enter it below along with your new password to complete recovery.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit Recovery OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 123456"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-mono text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Choose New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Updating password...</span>
                  ) : (
                    <>
                      <span>Set New Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotCodeSent(false);
                      setResetSuccessMsg(null);
                      setError(null);
                    }}
                    className="text-xs font-bold text-[#FF5500] hover:text-[#EA4C00] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Email Form</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-3 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Sending reset instructions...</span>
                  ) : (
                    <>
                      <span>Send Reset Link & OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setError(null);
                    }}
                    className="text-xs font-bold text-[#FF5500] hover:text-[#EA4C00] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </>
            )}
          </form>
        ) : (
          /* Form Body: Login & Register View */
          <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-3.5">
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {tab === 'register' && isVerificationCodeSent ? (
              // Verification Code Entry Screen (OTP)
              <div className="space-y-4 animate-fade-in py-2">
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-orange-850 text-xs leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-orange-700">
                    <Mail className="w-4.5 h-4.5 text-orange-600 shrink-0" />
                    <span>Email Verification Required</span>
                  </div>
                  <p className="text-slate-600 leading-normal">
                    We've sent a 6-digit verification code to <strong>{email}</strong>. Please enter the code below to verify your email and activate your account.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={signupCode}
                      onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 123456"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-3 text-sm font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-mono text-center"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Standard Login / Signup Forms
              <>
                {/* Registration Field: Full Name */}
                {tab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Veyrang Customer"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Registration Field: Phone Number */}
                {tab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number (For Delivery SMS)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3.5 text-xs font-mono font-bold text-slate-500 border-r border-slate-200 pr-2">
                        🇳🇬 +234
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="802 345 6789"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-24 pr-3 py-2.5 text-xs font-mono font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Registration Field: Delivery Address */}
                {tab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Default Delivery Address (Live Autocomplete)</label>
                    <AddressAutocompleteInput
                      value={address}
                      onChange={setAddress}
                      placeholder="Start typing street address or landmark..."
                    />
                  </div>
                )}

                {/* Common Field: Email Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Common Field: Password with Forgot Password Link */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Password</label>
                    {tab === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTab('forgot');
                          setError(null);
                        }}
                        className="text-xs font-bold text-[#FF5500] hover:text-[#EA4C00] transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-10 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength bar when registering */}
                  {tab === 'register' && password && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${passStrength.color} ${passStrength.width}`} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                        <span>Password Strength:</span>
                        <span className="font-bold text-slate-700">{passStrength.label}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Registration Field: Account Persona Role */}
                {tab === 'register' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#FF5500] cursor-pointer"
                    >
                      <option value="customer">Customer (Food Delivery & Storefront)</option>
                      <option value="restaurant">Merchant Kitchen (Manage Orders & Menu)</option>
                      <option value="courier">Courier Rider (Doorstep Delivery)</option>
                    </select>
                  </div>
                )}

                {/* Checkbox: Remember Me or Agree to Terms */}
                {tab === 'login' ? (
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#FF5500] focus:ring-[#FF5500] cursor-pointer accent-[#FF5500]"
                      />
                      <span className="text-xs font-medium text-slate-600">Remember me for 30 days</span>
                    </label>
                  </div>
                ) : (
                  <div className="pt-1">
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#FF5500] focus:ring-[#FF5500] cursor-pointer accent-[#FF5500] mt-0.5 shrink-0"
                      />
                      <span className="text-xs text-slate-600 leading-tight">
                        I agree to the <span className="font-bold text-slate-800">Veyrang Terms of Service</span> & <span className="font-bold text-slate-800">Privacy Policy</span>.
                      </span>
                    </label>
                  </div>
                )}
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[#FF5500] to-[#FF7700] hover:from-[#EA4C00] hover:to-[#FF5500] disabled:opacity-50 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              {loading ? (
                <span>Processing...</span>
              ) : tab === 'login' ? (
                <>
                  <span>Sign In to Veyrang</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : isVerificationCodeSent ? (
                <>
                  <span>Verify & Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Security Footer Notice */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit Encrypted Security</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">Veyrang NG v2.4</span>
        </div>

      </div>
    </div>
  );
};
