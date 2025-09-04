// FIX: Imported useState, useCallback, useEffect, useRef, and useContext from React to resolve hook-related errors.
import React, { useState, useCallback, useEffect, useRef, useContext } from 'react';
// FIX: Changed react-router-dom import to namespace import to fix module resolution issues.
import * as ReactRouterDom from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, Notification, Announcement } from '../types';
import { HomeIcon, DocumentTextIcon, UsersIcon, UserIcon, LogoutIcon, BellIcon, MenuIcon, XIcon, SearchIcon, SunIcon, MoonIcon, AcademicCapIcon } from './shared/Icons';
import { api } from '../services/firebase';
import { SearchContext, useBranding } from '../App';
import Modal from './shared/Modal';

const { NavLink, Outlet, useLocation, useNavigate } = ReactRouterDom;

const SidebarLink: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) =>
            `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isActive ? 'bg-primary text-white' : 'text-gray-200 hover:bg-primary-light hover:text-white'
            }`
        }
    >
        {icon}
        <span className="ml-3">{label}</span>
    </NavLink>
);

const Sidebar: React.FC<{ isOpen: boolean; setIsOpen: (isOpen: boolean) => void; logoUrl?: string; }> = ({ isOpen, setIsOpen, logoUrl }) => {
    const { user } = useAuth();
    
    return (
        <aside className={`w-64 bg-primary-dark text-white flex-shrink-0 flex-col h-screen fixed inset-y-0 left-0 z-40 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex`}>
            <div className="flex items-center justify-between h-16 px-4 border-b border-primary">
                {logoUrl ? (
                    <img src={logoUrl} alt="Institution Logo" className="h-10 w-auto" />
                ) : (
                    <span className="text-2xl font-bold">Logbook</span>
                )}
                <button onClick={() => setIsOpen(false)} className="md:hidden text-white hover:text-gray-300" aria-label="Close sidebar">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-2">
                {user?.role === UserRole.Student && (
                    <>
                        <SidebarLink to="/dashboard" icon={<HomeIcon className="w-6 h-6"/>} label="Dashboard" />
                        <SidebarLink to="/logs" icon={<DocumentTextIcon className="w-6 h-6"/>} label="My Logs" />
                        <SidebarLink to="/skills" icon={<AcademicCapIcon className="w-6 h-6"/>} label="Skills Tracker" />
                    </>
                )}
                {user?.role === UserRole.Supervisor && (
                    <>
                        <SidebarLink to="/dashboard" icon={<HomeIcon className="w-6 h-6"/>} label="Dashboard" />
                        <SidebarLink to="/students" icon={<UsersIcon className="w-6 h-6"/>} label="My Students" />
                        <SidebarLink to="/skills" icon={<AcademicCapIcon className="w-6 h-6"/>} label="Skills Tracker" />
                    </>
                )}
                {user?.role === UserRole.Admin && (
                    <>
                        <SidebarLink to="/dashboard" icon={<HomeIcon className="w-6 h-6"/>} label="Dashboard" />
                        <SidebarLink to="/users" icon={<UsersIcon className="w-6 h-6"/>} label="User Management" />
                    </>
                )}
                <SidebarLink to="/profile" icon={<UserIcon className="w-6 h-6"/>} label="Profile" />
            </nav>
        </aside>
    );
};

const Header: React.FC<{ onMenuClick: () => void; isDark: boolean; toggleTheme: () => void }> = ({ onMenuClick, isDark, toggleTheme }) => {
    const { user, logout } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [isLogoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const searchContext = useContext(SearchContext);
    const navigate = useNavigate();

    const [isSearchFocused, setSearchFocused] = useState(false);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        if (user) {
            const notifs = await api.getNotifications(user.id);
            setNotifications(notifs);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    if (!searchContext) return null; // Should not happen if within provider
    const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = searchContext;

    const handleSearchResultClick = () => {
        clearSearch();
        setSearchFocused(false);
        navigate('/logs');
    };

    const handleMarkAsRead = async (notificationId: string) => {
        await api.markNotificationAsRead(notificationId);
        fetchNotifications(); // Refresh notifications
    };
    
    const handleMarkAllAsRead = async () => {
        if (!user) return;
        await api.markAllNotificationsAsRead(user.id);
        fetchNotifications(); // Refresh notifications
    };
    
    const handleClearRead = async () => {
        if (!user) return;
        await api.clearReadNotifications(user.id);
        fetchNotifications(); // Refresh notifications
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    const readCount = notifications.length - unreadCount;

    return (
        <>
            <header className="h-16 bg-surface dark:bg-slate-800 dark:border-slate-700 border-b flex items-center justify-between px-4 sm:px-6">
                {/* Left Section */}
                <div className="flex items-center space-x-4">
                    <button onClick={onMenuClick} className="md:hidden text-gray-500 dark:text-gray-400 hover:text-primary" aria-label="Open sidebar">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    <div className="relative hidden sm:block" ref={searchContainerRef}>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input 
                            type="text" 
                            placeholder={user?.role === UserRole.Student ? "Search your logs..." : "Search (students only)"}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setSearchFocused(true)}
                            disabled={user?.role !== UserRole.Student}
                            className="block w-full bg-gray-100 dark:bg-slate-700 dark:text-slate-300 border border-transparent rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:text-gray-900 dark:focus:text-white focus:placeholder-gray-400 dark:focus:placeholder-gray-300 focus:ring-1 focus:ring-primary focus:border-primary transition disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        {isSearchFocused && searchQuery && user?.role === UserRole.Student && (
                            <div className="absolute mt-2 w-full min-w-[300px] bg-surface dark:bg-slate-800 rounded-lg shadow-xl border dark:border-slate-700 z-30">
                                <div className="max-h-80 overflow-y-auto">
                                    {isSearching && <div className="p-3 text-sm text-gray-500 dark:text-slate-400">Searching...</div>}
                                    {!isSearching && searchResults.length > 0 && searchResults.map(log => (
                                        <button 
                                            key={log.id} 
                                            onClick={handleSearchResultClick}
                                            className="w-full text-left p-3 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 border-b dark:border-slate-700 last:border-b-0 cursor-pointer"
                                        >
                                            <p className="font-semibold dark:text-slate-200 truncate">{log.title} <span className="font-normal text-gray-400">(Week {log.week})</span></p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">{log.content}</p>
                                        </button>
                                    ))}
                                    {!isSearching && searchResults.length === 0 && (
                                        <div className="p-3 text-sm text-gray-500 dark:text-slate-400">No logs found for "{searchQuery}".</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center space-x-2 sm:space-x-4">
                    <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700" title="Toggle theme">
                        {isDark ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
                    </button>
                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setDropdownOpen(!isDropdownOpen)} className="relative text-gray-500 dark:text-gray-400 hover:text-primary">
                            <BellIcon className="w-6 h-6" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                        {isDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-surface dark:bg-slate-800 rounded-lg shadow-xl border dark:border-slate-700 z-20">
                                <div className="p-3 font-semibold text-sm border-b dark:border-slate-700 dark:text-slate-200">Notifications</div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length > 0 ? notifications.map(n => (
                                        <div key={n.id} className={`p-3 text-sm border-b dark:border-slate-700 last:border-b-0 flex items-start gap-3 ${!n.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                            <div className="flex-grow">
                                                <p className="dark:text-slate-300">{n.message}</p>
                                                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                            </div>
                                            {!n.read && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleMarkAsRead(n.id);
                                                    }}
                                                    title="Mark as read"
                                                    aria-label="Mark as read"
                                                    className="flex-shrink-0 w-3 h-3 mt-1 bg-primary rounded-full hover:bg-primary-dark ring-2 ring-transparent focus:outline-none focus:ring-primary-light"
                                                ></button>
                                            )}
                                        </div>
                                    )) : <p className="p-3 text-sm text-gray-500 dark:text-slate-400">No new notifications.</p>}
                                </div>
                                {notifications.length > 0 && (
                                    <div className="p-2 flex justify-between items-center border-t dark:border-slate-700">
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            disabled={unreadCount === 0}
                                            className="text-sm text-primary dark:text-blue-400 hover:underline disabled:text-gray-400 dark:disabled:text-slate-500 disabled:no-underline disabled:cursor-not-allowed"
                                        >
                                            Mark all as read
                                        </button>
                                        <button
                                            onClick={handleClearRead}
                                            disabled={readCount === 0}
                                            className="text-sm text-red-500 dark:text-red-400 hover:underline disabled:text-gray-400 dark:disabled:text-slate-500 disabled:no-underline disabled:cursor-not-allowed"
                                        >
                                            Clear Read
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center">
                        <div className="text-right mr-3 hidden sm:block">
                            <p className="font-semibold text-sm dark:text-slate-200">{user?.firstName} {user?.surname}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
                        </div>
                        {user?.avatarUrl ? (
                            <img className="h-9 w-9 rounded-full object-cover" src={user.avatarUrl} alt="User avatar" />
                        ) : (
                            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm select-none">
                                {user?.firstName?.[0]}{user?.surname?.[0]}
                            </div>
                        )}
                    </div>
                    <button onClick={() => setLogoutConfirmOpen(true)} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-primary" title="Logout">
                        <LogoutIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <Modal isOpen={isLogoutConfirmOpen} onClose={() => setLogoutConfirmOpen(false)} title="Confirm Logout">
                <div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">Are you sure you want to log out?</p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={() => setLogoutConfirmOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500">
                            Cancel
                        </button>
                        <button onClick={logout} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">
                            Log Out
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

const AnnouncementBanner: React.FC<{ announcement: Announcement; onDismiss: () => void }> = ({ announcement, onDismiss }) => (
    <div className="bg-primary-dark text-white p-3 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex-1">
                <p className="font-bold">{announcement.title}</p>
                <p className="text-sm">{announcement.content}</p>
            </div>
            <button onClick={onDismiss} className="ml-4 p-1 rounded-full hover:bg-white/20" aria-label="Dismiss announcement">
                <XIcon className="w-5 h-5" />
            </button>
        </div>
    </div>
);

const Layout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const [isDark, setIsDark] = useState(() => {
        if (localStorage.getItem('theme') === 'dark') return true;
        if (localStorage.getItem('theme') === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
    const { branding } = useBranding();


    useEffect(() => {
        // Fetch Announcements
        api.getAnnouncements().then(data => {
            setAnnouncements(data.filter(a => a.active));
        });
    }, [location.pathname]);

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    // Close sidebar on route change on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    const getPageTitle = () => {
        switch (location.pathname) {
            case '/dashboard':
                return 'Dashboard';
            case '/logs':
                return 'My Logs';
            case '/skills':
                return 'Skills Tracker';
            case '/students':
                return 'My Students';
            case '/users':
                return 'User Management';
            case '/profile':
                return 'Profile';
            default:
                if (location.pathname.startsWith('/student/')) return 'Student Logs';
                return 'Dashboard';
        }
    };
    
    const activeAnnouncement = announcements.find(a => !dismissedAnnouncements.includes(a.id));

    return (
        <div className="flex h-screen bg-background dark:bg-black">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} logoUrl={branding.logoUrl} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onMenuClick={() => setIsSidebarOpen(true)} isDark={isDark} toggleTheme={() => setIsDark(prev => !prev)} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    {activeAnnouncement && (
                        <AnnouncementBanner 
                            announcement={activeAnnouncement} 
                            onDismiss={() => setDismissedAnnouncements([...dismissedAnnouncements, activeAnnouncement.id])}
                        />
                    )}
                    <div className="p-4 sm:p-6 md:p-8">
                        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface dark:text-white mb-6">{getPageTitle()}</h1>
                        <Outlet />
                    </div>
                </main>
            </div>
            {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black bg-opacity-30 z-30 md:hidden" aria-hidden="true"></div>}
        </div>
    );
};

export default Layout;
