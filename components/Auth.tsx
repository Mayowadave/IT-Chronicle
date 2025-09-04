import React, { useState } from 'react';
// FIX: Changed react-router-dom import to namespace import to fix module resolution issues.
import * as ReactRouterDom from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { sendPasswordResetEmail } from '@firebase/auth';
import { auth } from '../services/firebase';
import { EyeIcon, EyeOffIcon } from './shared/Icons';
import { AvatarUploader } from './shared/ImageUpload';

const { useNavigate } = ReactRouterDom;

enum AuthMode {
  Login = 'login',
  Register = 'register',
  ForgotPassword = 'forgot_password',
}

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>(AuthMode.Login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.Student);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Student fields
  const [supervisorCode, setSupervisorCode] = useState('');
  const [gender, setGender] = useState('');
  const [school, setSchool] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState(100);

  // Supervisor fields
  const [companyName, setCompanyName] = useState('');
  const [companyRole, setCompanyRole] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setAvatarUrl(null);
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
        await sendPasswordResetEmail(auth, email);
        setSuccess("Password reset email sent! Please check your inbox and spam folder.");
    } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
            setError("No account found with this email address.");
        } else {
            setError(err.message || 'Failed to send reset email.');
        }
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === AuthMode.Login) {
        await login(email, password);
        navigate('/dashboard');
      } else {
        if (password !== confirmPassword) {
            throw new Error("Passwords do not match.");
        }
        if (role === UserRole.Student && !avatarUrl) {
            throw new Error("Please upload a profile picture. This is required for students.");
        }
        const payload = { 
            firstName,
            surname,
            email, 
            password, 
            role, 
            avatarUrl,
            supervisorCode: role === UserRole.Student ? supervisorCode : undefined,
            gender: role === UserRole.Student ? gender : undefined,
            school: role === UserRole.Student ? school : undefined,
            faculty: role === UserRole.Student ? faculty : undefined,
            department: role === UserRole.Student ? department : undefined,
            level: role === UserRole.Student ? Number(level) : undefined,
            companyName: role === UserRole.Supervisor ? companyName : undefined,
            companyRole: role === UserRole.Supervisor ? companyRole : undefined
        };
        const registrationError = await register(payload);
        if (registrationError) {
            throw new Error(registrationError);
        }
        setSuccess("Registration successful! A verification email has been sent. Please check your inbox (and spam folder) to verify your account before logging in.");
        setPassword('');
        setConfirmPassword('');
        setAvatarUrl(null);
        setMode(AuthMode.Login);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLogin = mode === AuthMode.Login;
  const isForgotPassword = mode === AuthMode.ForgotPassword;
  const inputStyles = "w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200";

  return (
    <div className="min-h-screen bg-background dark:bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface dark:bg-slate-800 shadow-2xl rounded-xl p-8">
          <h1 className="text-3xl font-bold text-center text-primary mb-2">
            <span className="bg-primary text-white px-2 py-1 rounded-md mr-1">IT</span>-Chronicle
          </h1>
          
          {isForgotPassword ? (
             <p className="text-center text-secondary dark:text-slate-400 mb-6">Reset your password.</p>
          ) : (
            <>
              <p className="text-center text-secondary dark:text-slate-400 mb-6">{isLogin ? 'Welcome back! Please sign in.' : 'Create your new account.'}</p>
              <div className="flex border-b dark:border-slate-700 mb-6">
                <button onClick={() => switchMode(AuthMode.Login)} className={`flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>Login</button>
                <button onClick={() => switchMode(AuthMode.Register)} className={`flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? 'text-primary border-b-2 border-primary' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>Register</button>
              </div>
            </>
          )}

          {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300 px-4 py-3 rounded-md text-sm">{error}</div>}
          {success && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 dark:bg-green-900/50 dark:border-green-500/50 dark:text-green-300 px-4 py-3 rounded-md text-sm">{success}</div>}

          {isForgotPassword ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-300">Enter your account's email address and we will send you a link to reset your password. Don't forget to check your spam folder!</p>
              <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required className={inputStyles} />
              <button type="submit" disabled={isLoading} className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:bg-primary-light">
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => switchMode(AuthMode.Login)} className="text-sm font-medium text-primary hover:underline">
                  &larr; Back to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                      <label className="text-sm text-center block font-medium text-gray-700 dark:text-slate-300">Profile Picture</label>
                      <AvatarUploader 
                          avatarPreview={avatarUrl}
                          onAvatarSelected={setAvatarUrl}
                      />
                      <p className="text-xs text-center text-gray-500 dark:text-slate-400 -mt-1">
                          {role === UserRole.Student ? "Required for students." : "Optional for supervisors."}
                      </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                      <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputStyles} />
                      <input type="text" placeholder="Surname" value={surname} onChange={e => setSurname(e.target.value)} required className={inputStyles} />
                  </div>
                </>
              )}
              
              <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required className={inputStyles} />
              <div className="relative">
                  <input type={isPasswordVisible ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className={`${inputStyles} pr-10`} />
                  <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200" aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}>
                      {isPasswordVisible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
              </div>

              {isLogin && (
                  <div className="text-right -mt-2 mb-2">
                      <button
                          type="button"
                          onClick={() => switchMode(AuthMode.ForgotPassword)}
                          className="text-sm font-medium text-primary hover:underline focus:outline-none"
                      >
                          Forgot Password?
                      </button>
                  </div>
              )}
              
              {!isLogin && (
                <>
                  <div className="relative">
                     <input type={isConfirmPasswordVisible ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={`${inputStyles} pr-10`} />
                      <button type="button" onClick={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200" aria-label={isConfirmPasswordVisible ? 'Hide password' : 'Show password'}>
                         {isConfirmPasswordVisible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                  </div>

                  <select value={role} onChange={e => setRole(e.target.value as UserRole)} className={inputStyles}>
                    <option value={UserRole.Student}>Student</option>
                    <option value={UserRole.Supervisor}>Supervisor</option>
                  </select>
                  {role === UserRole.Student && (
                    <>
                      <input type="text" placeholder="Supervisor Code (Optional)" value={supervisorCode} onChange={e => setSupervisorCode(e.target.value)} className={inputStyles} />
                      <select value={gender} onChange={e => setGender(e.target.value)} required className={inputStyles}>
                          <option value="" disabled>Select Gender</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                      </select>
                      <input type="text" placeholder="School" value={school} onChange={e => setSchool(e.target.value)} required className={inputStyles} />
                      <input type="text" placeholder="Faculty" value={faculty} onChange={e => setFaculty(e.target.value)} required className={inputStyles} />
                      <input type="text" placeholder="Department" value={department} onChange={e => setDepartment(e.target.value)} required className={inputStyles} />
                      <input type="number" placeholder="Level (e.g. 100)" value={level} onChange={e => setLevel(Number(e.target.value))} min="100" step="100" required className={inputStyles} />
                    </>
                  )}
                  {role === UserRole.Supervisor && (
                    <>
                      <input type="text" placeholder="Company Name" value={companyName} onChange={e => setCompanyName(e.target.value)} required className={inputStyles} />
                      <input type="text" placeholder="Role in Company" value={companyRole} onChange={e => setCompanyRole(e.target.value)} required className={inputStyles} />
                    </>
                  )}
                </>
              )}

              <button type="submit" disabled={isLoading} className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:bg-primary-light">
                {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;