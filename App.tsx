import React, { ReactNode, useState, useRef, createContext, useContext, useCallback, useEffect } from 'react';
// FIX: Changed react-router-dom import to namespace import to fix module resolution issues.
import * as ReactRouterDom from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AuthPage from './components/Auth';
import { StudentDashboard, StudentLogsPage } from './components/Student';
import { SupervisorDashboard, SupervisorStudentsPage } from './components/Supervisor';
import { AdminDashboard, AdminUserManagementPage } from './components/Admin';
import { UserRole, LogEntry, BrandingSettings } from './types';
import { api } from './services/firebase';
import Modal from './components/shared/Modal';
import { PencilIcon } from './components/shared/Icons';
import { SkillsPage } from './components/Skills';

const { HashRouter, Routes, Route, Navigate, Outlet } = ReactRouterDom;

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: LogEntry[];
  isSearching: boolean;
  clearSearch: () => void;
}

export const SearchContext = createContext<SearchContextType | undefined>(undefined);

const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<LogEntry[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const { user } = useAuth();

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
    };

    const performSearch = useCallback(async (query: string) => {
        if (!query.trim() || user?.role !== UserRole.Student) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        if (user) {
            setIsSearching(true);
            try {
                const logs = await api.getLogsForStudent(user.id);
                const filteredLogs = logs.filter(log =>
                    log.title.toLowerCase().includes(query.toLowerCase()) ||
                    log.content.toLowerCase().includes(query.toLowerCase())
                );
                setSearchResults(filteredLogs);
            } catch (error) {
                console.error("Error searching logs:", error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }
    }, [user]);

    useEffect(() => {
        const handler = setTimeout(() => {
            performSearch(searchQuery);
        }, 300);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery, performSearch]);

    return (
        <SearchContext.Provider value={{ searchQuery, setSearchQuery, searchResults, isSearching, clearSearch }}>
            {children}
        </SearchContext.Provider>
    );
};

interface BrandingContextType {
    branding: BrandingSettings;
    refreshBranding: () => void;
}

export const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const useBranding = () => {
    const context = useContext(BrandingContext);
    if (context === undefined) {
        throw new Error('useBranding must be used within a BrandingProvider');
    }
    return context;
};

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [branding, setBranding] = useState<BrandingSettings>({});

    const refreshBranding = useCallback(async () => {
        const settings = await api.getBrandingSettings();
        setBranding(settings || {});
    }, []);

    useEffect(() => {
        refreshBranding();
    }, [refreshBranding]);

    // Apply theme class to document root
    useEffect(() => {
        const root = document.documentElement;
        // remove old theme classes
        root.classList.forEach(className => {
            if (className.startsWith('theme-')) {
                root.classList.remove(className);
            }
        });
        // add new theme class
        if (branding.theme && branding.theme !== 'default') {
            root.classList.add(`theme-${branding.theme}`);
        }
    }, [branding.theme]);

    return (
        <BrandingContext.Provider value={{ branding, refreshBranding }}>
            {children}
        </BrandingContext.Provider>
    );
};


// --- Profile Picture Upload Components ---

const CameraModal: React.FC<{ isOpen: boolean; onClose: () => void; onCapture: (dataUrl: string) => void; }> = ({ isOpen, onClose, onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            if (isOpen) {
                try {
                    setError(null);
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera:", err);
                    setError("Could not access camera. Please check permissions.");
                }
            }
        };

        startCamera();

        return () => {
            // Cleanup: stop camera stream when modal is closed
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isOpen]);

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas) {
            const context = canvas.getContext('2d');
            if (context) {
                // Set canvas dimensions to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg');
                onCapture(dataUrl);
            }
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Take Photo">
            <div className="space-y-4">
                {error ? (
                    <div className="bg-red-100 text-red-700 p-3 rounded-md">{error}</div>
                ) : (
                    <div className="bg-black rounded-md overflow-hidden">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                )}
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                    <button onClick={handleCapture} disabled={!!error} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50">Capture</button>
                </div>
            </div>
        </Modal>
    );
};

const UploadOptionsModal: React.FC<{ isOpen: boolean; onClose: () => void; onTakePhoto: () => void; onChooseFile: () => void; }> = ({ isOpen, onClose, onTakePhoto, onChooseFile }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Profile Picture">
        <div className="flex flex-col space-y-3">
            <button onClick={onTakePhoto} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Take Photo with Camera</button>
            <button onClick={onChooseFile} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Choose from Library</button>
        </div>
    </Modal>
);

const ProfilePage: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadOptionsOpen, setUploadOptionsOpen] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => {
        if (!isUploading) {
            setUploadOptionsOpen(true);
        }
    };

    const handleChooseFile = () => {
        setUploadOptionsOpen(false);
        fileInputRef.current?.click();
    };

    const handleTakePhoto = () => {
        setUploadOptionsOpen(false);
        setIsCameraOpen(true);
    };

    const uploadProfilePicture = async (base64String: string) => {
        if (!user) return;
        setIsUploading(true);
        try {
            const updatedUser = await api.updateUserProfilePicture(user.id, base64String);
            if (updatedUser) {
                updateUser(updatedUser);
            }
        } catch (error) {
            console.error("Failed to upload profile picture", error);
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            uploadProfilePicture(base64String);
        };
        reader.readAsDataURL(file);
    };
    
    const handleCapture = (dataUrl: string) => {
        setIsCameraOpen(false);
        uploadProfilePicture(dataUrl);
    };

    const DetailItem: React.FC<{ label: string, value?: string | null }> = ({ label, value }) => (
        <div>
            <label className="text-sm text-gray-500 dark:text-slate-400">{label}</label>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    );

    return (
        <div className="bg-surface dark:bg-slate-800 p-6 rounded-lg shadow-md max-w-2xl">
            <h2 className="text-xl font-semibold mb-6 dark:text-white">Account Information</h2>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                 <div className="relative group">
                    <button onClick={handleAvatarClick} className="w-28 h-28 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface dark:focus:ring-offset-slate-800 focus:ring-primary" disabled={isUploading}>
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt="Profile" className="w-28 h-28 rounded-full object-cover"/>
                        ) : (
                            <div className="w-28 h-28 rounded-full bg-primary flex items-center justify-center text-white font-bold text-4xl select-none">
                                {user?.firstName?.[0]}{user?.surname?.[0]}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 rounded-full flex items-center justify-center transition-opacity duration-300">
                           {!isUploading && <PencilIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />}
                        </div>
                         {isUploading && (
                            <div className="absolute inset-0 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                                <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            </div>
                        )}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg" />
                </div>
                <div className="space-y-4 text-gray-700 dark:text-slate-300 flex-1 text-center sm:text-left">
                    <DetailItem label="First Name" value={user?.firstName} />
                    <DetailItem label="Surname" value={user?.surname} />
                    <DetailItem label="Email" value={user?.email} />
                     <div>
                        <label className="text-sm text-gray-500 dark:text-slate-400">Role</label>
                        <p className="text-lg capitalize font-semibold">{user?.role}</p>
                    </div>

                    {user?.role === UserRole.Supervisor && (
                       <>
                        <DetailItem label="Company" value={user.companyName} />
                        <DetailItem label="Role in Company" value={user.companyRole} />
                        <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg border dark:border-blue-500/30 border-blue-200 mt-4">
                            <p className="text-sm text-blue-800 dark:text-blue-200">Your unique Supervisor Code is:</p>
                            <p className="font-mono text-lg font-bold text-blue-900 dark:text-blue-100 tracking-widest">{user.supervisorCode}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Share this code with your students to link them to your account.</p>
                        </div>
                       </>
                    )}
                </div>
            </div>
            
            <UploadOptionsModal 
                isOpen={isUploadOptionsOpen} 
                onClose={() => setUploadOptionsOpen(false)}
                onTakePhoto={handleTakePhoto}
                onChooseFile={handleChooseFile}
            />

            <CameraModal 
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={handleCapture}
            />
        </div>
    );
};


const ProtectedRoute: React.FC<{ children?: ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }
    return isAuthenticated ? (children ?? <Outlet />) : <Navigate to="/login" replace />;
};

const RoleBasedDashboard: React.FC = () => {
    const { user } = useAuth();
    switch (user?.role) {
        case UserRole.Student:
            return <StudentDashboard />;
        case UserRole.Supervisor:
            return <SupervisorDashboard />;
        case UserRole.Admin:
            return <AdminDashboard />;
        default:
            return <Navigate to="/login" />;
    }
};

function App() {
    return (
        <AuthProvider>
            <BrandingProvider>
                <SearchProvider>
                    <HashRouter>
                        <Routes>
                            <Route path="/login" element={<AuthPage />} />
                            <Route element={<ProtectedRoute />}>
                                <Route element={<Layout />}>
                                    <Route path="/dashboard" element={<RoleBasedDashboard />} />
                                    <Route path="/logs" element={<StudentLogsPage />} />
                                    <Route path="/skills" element={<SkillsPage />} />
                                    <Route path="/students" element={<SupervisorStudentsPage />} />
                                    <Route path="/users" element={<AdminUserManagementPage />} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                    <Route path="/" element={<Navigate to="/dashboard" />} />
                                </Route>
                            </Route>
                            <Route path="*" element={<Navigate to="/" />} />
                        </Routes>
                    </HashRouter>
                </SearchProvider>
            </BrandingProvider>
        </AuthProvider>
    );
}

export default App;
