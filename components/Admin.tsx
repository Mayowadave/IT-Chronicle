import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { User, UserRole, SystemEvent, Announcement, ProgramCycle, LogEntry, BrandingSettings } from '../types';
import Modal from './shared/Modal';
import { UsersIcon, XIcon } from './shared/Icons';
import { sendPasswordResetEmail } from '@firebase/auth';
import { auth } from '../services/firebase';
// FIX: Changed react-router-dom import to namespace import to fix module resolution issues.
import * as ReactRouterDom from 'react-router-dom';
import { useBranding } from '../App';

const { Navigate } = ReactRouterDom;

// --- UTILITY & SHARED COMPONENTS ---

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
    const roleColors = {
        [UserRole.Admin]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
        [UserRole.Supervisor]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        [UserRole.Student]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColors[role]}`}>{role}</span>;
};

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; color: string; onClick?: () => void }> = ({ icon, title, value, color, onClick }) => (
    <div
        onClick={onClick}
        className={`bg-surface dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4 border-l-4 ${color} ${onClick ? 'cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50' : ''}`}
    >
        <div className="flex-shrink-0">{icon}</div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-on-surface dark:text-slate-100">{value}</p>
        </div>
    </div>
);


// --- ADMIN DASHBOARD ---

export const AdminDashboard: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [events, setEvents] = useState<SystemEvent[]>([]);
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [programCycles, setProgramCycles] = useState<ProgramCycle[]>([]);
    const { branding, refreshBranding } = useBranding();
    const [activeTab, setActiveTab] = useState('overview');
    const [isAtRiskModalOpen, setIsAtRiskModalOpen] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        const [usersData, announcementsData, cyclesData, eventsData] = await Promise.all([
            api.getAllUsers(),
            api.getAnnouncements(),
            api.getProgramCycles(),
            api.getSystemEvents(20)
        ]);
        
        const allLogs = (await Promise.all(usersData.map(u => api.getLogsForStudent(u.id)))).flat();
        
        setUsers(usersData);
        setLogs(allLogs);
        setAnnouncements(announcementsData);
        setProgramCycles(cyclesData);
        setEvents(eventsData);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        const students = users.filter(u => u.role === UserRole.Student);
        const supervisors = users.filter(u => u.role === UserRole.Supervisor);
        const now = new Date();
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const atRiskStudentsList = students.filter(s => !s.lastLogin || new Date(s.lastLogin) < twoWeeksAgo);
        
        const supervisorReviews: {[key: string]: number} = {};
        logs.forEach(log => {
            const student = users.find(u => u.id === log.studentId);
            if (student?.supervisorId) {
                supervisorReviews[student.supervisorId] = (supervisorReviews[student.supervisorId] || 0) + 1;
            }
        });
        const activeSupervisors = Object.keys(supervisorReviews).length;
        const avgReviews = activeSupervisors > 0 ? (logs.length / activeSupervisors).toFixed(1) : 0;
        
        return { 
            totalUsers: users.length,
            students: students.length,
            supervisors: supervisors.length,
            atRiskStudents: atRiskStudentsList.length,
            atRiskStudentsList,
            avgReviews
        };
    }, [users, logs]);

    const handleCreateAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const title = (form.elements.namedItem('title') as HTMLInputElement).value;
        const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
        await api.createAnnouncement(title, content);
        form.reset();
        fetchData();
    };
    
    const handleToggleAnnouncement = async (id: string, status: boolean) => {
        await api.toggleAnnouncementStatus(id, status);
        fetchData();
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this announcement?")) {
            try {
                await api.deleteAnnouncement(id);
                await fetchData();
            } catch (error) {
                console.error("Failed to delete announcement:", error);
                alert("An error occurred while deleting the announcement.");
            }
        }
    };
    
    const handleBrandingUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const theme = (form.elements.namedItem('theme') as HTMLSelectElement).value as BrandingSettings['theme'];
        const logoFile = (form.elements.namedItem('logo') as HTMLInputElement).files?.[0];
    
        let newBrandingSettings: BrandingSettings = { ...branding, theme: theme };
        
        if (logoFile) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                newBrandingSettings.logoUrl = reader.result as string;
                await api.updateBrandingSettings(newBrandingSettings);
                refreshBranding();
                alert("Branding settings updated successfully.");
            };
            reader.readAsDataURL(logoFile);
        } else {
            await api.updateBrandingSettings(newBrandingSettings);
            refreshBranding();
        }
    };

    const handleCreateCycle = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const name = (form.elements.namedItem('name') as HTMLInputElement).value;
        const startDate = (form.elements.namedItem('startDate') as HTMLInputElement).value;
        const endDate = (form.elements.namedItem('endDate') as HTMLInputElement).value;
        await api.createProgramCycle(name, startDate, endDate);
        form.reset();
        fetchData();
    };

    const handleDeleteCycle = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this program cycle?")) {
            try {
                await api.deleteProgramCycle(id);
                await fetchData();
            } catch (error) {
                console.error("Failed to delete program cycle:", error);
                alert("An error occurred while deleting the program cycle.");
            }
        }
    };
    

    if (isLoading) return <div className="text-center p-8">Loading admin dashboard...</div>;

    const TabButton: React.FC<{ label: string; name: string; }> = ({ label, name }) => (
        <button
            onClick={() => setActiveTab(name)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === name
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b dark:border-slate-700 pb-4">
                <TabButton label="Overview" name="overview" />
                <TabButton label="Announcements" name="announcements" />
                <TabButton label="Branding" name="branding" />
                <TabButton label="Program Cycles" name="cycles" />
            </div>

            {activeTab === 'overview' && (
                <>
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                            <StatCard icon={<UsersIcon className="w-10 h-10 text-blue-500" />} title="Total Users" value={stats.totalUsers} color="border-blue-500" />
                            <StatCard icon={<UsersIcon className="w-10 h-10 text-green-500" />} title="Students" value={stats.students} color="border-green-500" />
                            <StatCard icon={<UsersIcon className="w-10 h-10 text-purple-500" />} title="Supervisors" value={stats.supervisors} color="border-purple-500" />
                            <StatCard icon={<UsersIcon className="w-10 h-10 text-yellow-500" />} title="Avg. Reviews / Supervisor" value={stats.avgReviews} color="border-yellow-500" />
                            <StatCard 
                                icon={<UsersIcon className="w-10 h-10 text-red-500" />} 
                                title="At-Risk Students" 
                                value={stats.atRiskStudents} 
                                color="border-red-500"
                                onClick={() => stats.atRiskStudents > 0 && setIsAtRiskModalOpen(true)}
                            />
                        </div>
                        <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-4">Recent System Activity</h3>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {events.map(event => (
                                    <div key={event.id} className="text-sm border-b dark:border-slate-700 pb-2 last:border-0">
                                        <p className="dark:text-slate-300">{event.message}</p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500">{new Date(event.timestamp).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                     <Modal isOpen={isAtRiskModalOpen} onClose={() => setIsAtRiskModalOpen(false)} title={`At-Risk Students (${stats.atRiskStudentsList.length})`}>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            <p className="text-sm text-gray-500 dark:text-slate-400 -mt-2 mb-4">Students who have not logged in for 2 weeks or more.</p>
                            {stats.atRiskStudentsList.length > 0 ? (
                                stats.atRiskStudentsList.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {student.avatarUrl ? (
                                                <img src={student.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm select-none">
                                                    {student.firstName?.[0]}{student.surname?.[0]}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-semibold dark:text-slate-200">{student.firstName} {student.surname}</p>
                                                <p className="text-sm text-gray-500 dark:text-slate-400">{student.email}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-red-600 dark:text-red-400">Last Login</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">{student.lastLogin ? new Date(student.lastLogin).toLocaleDateString() : 'Never'}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 dark:text-slate-400 text-center py-4">No students are currently at risk.</p>
                            )}
                        </div>
                    </Modal>
                </>
            )}
            
            {activeTab === 'announcements' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-4">New Announcement</h3>
                        <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Title</label>
                                <input type="text" name="title" required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" />
                            </div>
                            <div>
                                <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Content</label>
                                <textarea name="content" rows={4} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200"></textarea>
                            </div>
                            <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-dark transition-colors">Post Announcement</button>
                        </form>
                    </div>
                     <div className="lg:col-span-2 bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-4">Manage Announcements</h3>
                         <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                             {announcements.map(a => (
                                 <div key={a.id} className="p-4 border dark:border-slate-700 rounded-lg">
                                     <div className="flex justify-between items-start">
                                        <div>
                                            <p className={`font-bold ${a.active ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}`}>{a.title} ({a.active ? 'Active' : 'Inactive'})</p>
                                            <p className="text-sm dark:text-slate-300">{a.content}</p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(a.createdAt).toLocaleDateString()}</p>
                                        </div>
                                         <div className="flex gap-2 flex-shrink-0 ml-4">
                                             <button onClick={() => handleToggleAnnouncement(a.id, a.active)} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{a.active ? 'Deactivate' : 'Activate'}</button>
                                             <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">Delete</button>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'branding' && (
                 <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md max-w-lg mx-auto">
                    <h3 className="text-lg font-semibold dark:text-slate-200 mb-4">Branding & Customization</h3>
                    <form onSubmit={handleBrandingUpdate} className="space-y-4">
                        <div>
                             <label htmlFor="logo" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Logo</label>
                             {branding.logoUrl && <img src={branding.logoUrl} alt="Current logo" className="h-12 my-2 bg-gray-100 dark:bg-slate-700 p-1 rounded-md" />}
                             <input type="file" name="logo" accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-primary dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
                        </div>
                        <div>
                             <label htmlFor="theme" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Color Theme</label>
                             <select name="theme" defaultValue={branding.theme || 'default'} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200">
                                <option value="default">Default Blue</option>
                                <option value="teal">Teal</option>
                                <option value="rose">Rose</option>
                                <option value="indigo">Indigo</option>
                                <option value="emerald">Emerald</option>
                                <option value="amber">Amber</option>
                             </select>
                        </div>
                        <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-dark transition-colors">Save Branding</button>
                    </form>
                </div>
            )}
            
            {activeTab === 'cycles' && (
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-4">New Program Cycle</h3>
                        <form onSubmit={handleCreateCycle} className="space-y-4">
                             <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Cycle Name</label>
                                <input type="text" name="name" required placeholder="e.g., Fall 2024" className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Start Date</label>
                                    <input type="date" name="startDate" required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" />
                                </div>
                                <div>
                                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-slate-300">End Date</label>
                                    <input type="date" name="endDate" required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-dark transition-colors">Create Cycle</button>
                        </form>
                    </div>
                     <div className="lg:col-span-2 bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-4">Existing Cycles</h3>
                        <div className="space-y-3">
                            {programCycles.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-3 border dark:border-slate-700 rounded-lg">
                                    <div>
                                        <p className="font-semibold dark:text-slate-200">{c.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-slate-400">{new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => handleDeleteCycle(c.id)} className="text-red-500 hover:text-red-700"><XIcon className="w-5 h-5"/></button>
                                </div>
                            ))}
                        </div>
                     </div>
                </div>
            )}
        </div>
    );
};


// --- USER MANAGEMENT PAGE ---

const DetailItem: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => {
    if (!value) return null;
    return (
        <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-slate-700 last:border-b-0">
            <span className="text-sm text-gray-500 dark:text-slate-400">{label}:</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200 text-right">{value}</span>
        </div>
    );
};

const UserDetailsModal: React.FC<{ user: User | null, onClose: () => void }> = ({ user, onClose }) => {
    if (!user) return null;

    return (
        <Modal isOpen={!!user} onClose={onClose} title="User Details">
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                {user.avatarUrl ? (
                    <img className="h-24 w-24 rounded-full object-cover flex-shrink-0" src={user.avatarUrl} alt={`${user.firstName}'s avatar`} />
                ) : (
                    <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center text-white font-bold text-4xl select-none flex-shrink-0">
                        {user.firstName?.[0]}{user.surname?.[0]}
                    </div>
                )}
                <div className="w-full text-center sm:text-left">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">{user.firstName} {user.surname}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{user.email}</p>
                    <div className="mt-2"><RoleBadge role={user.role} /></div>
                </div>
            </div>
            <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-800 dark:text-slate-200 mb-2">Additional Information</h4>
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg">
                    {user.role === UserRole.Student && (
                        <>
                            <DetailItem label="Gender" value={user.gender} />
                            <DetailItem label="School" value={user.school} />
                            <DetailItem label="Faculty" value={user.faculty} />
                            <DetailItem label="Department" value={user.department} />
                            <DetailItem label="Level" value={user.level} />
                            <DetailItem label="Supervisor ID" value={user.supervisorId} />
                        </>
                    )}
                    {user.role === UserRole.Supervisor && (
                        <>
                            <DetailItem label="Company" value={user.companyName} />
                            <DetailItem label="Role" value={user.companyRole} />
                            <DetailItem label="Supervisor Code" value={user.supervisorCode} />
                        </>
                    )}
                     {user.role === UserRole.Admin && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">This user has administrative privileges.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const UserDisplay: React.FC<{
    users: User[];
    currentUser: User | null;
    onSelectUser: (user: User) => void;
    onDeleteUser: (user: User) => void;
    onResetPassword: (user: User) => void;
    searchTerm: string;
}> = ({ users, currentUser, onSelectUser, onDeleteUser, onResetPassword, searchTerm }) => {
    
    if (users.length === 0) {
        return (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold dark:text-slate-200">No Users Found</h3>
                {searchTerm ? (
                     <p className="text-gray-500 dark:text-slate-400 mt-1">Your search for "{searchTerm}" did not match any users.</p>
                ) : (
                    <p className="text-gray-500 dark:text-slate-400 mt-1">There are no users in this category.</p>
                )}
            </div>
        );
    }
    
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Details</th>
                        <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td onClick={() => onSelectUser(user)} className="px-6 py-4 whitespace-nowrap cursor-pointer">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        {user.avatarUrl ? (
                                            <img className="h-10 w-10 rounded-full object-cover" src={user.avatarUrl} alt="" />
                                        ) : (
                                            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm select-none">
                                                {user.firstName?.[0]}{user.surname?.[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900 dark:text-slate-200">{user.firstName} {user.surname}</div>
                                    </div>
                                </div>
                            </td>
                            <td onClick={() => onSelectUser(user)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400 cursor-pointer">{user.email}</td>
                            <td onClick={() => onSelectUser(user)} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400 cursor-pointer">
                                {user.role === UserRole.Supervisor && `Code: ${user.supervisorCode}`}
                                {user.role === UserRole.Student && `Supervisor ID: ${user.supervisorId || 'N/A'}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                    <button onClick={() => onResetPassword(user)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                                    Reset Password
                                </button>
                                <button 
                                    onClick={() => onDeleteUser(user)}
                                    disabled={user.id === currentUser?.id}
                                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-red-600 dark:disabled:hover:text-red-400"
                                    title={user.id === currentUser?.id ? "You cannot delete your own account" : "Delete user"}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

interface ImportResult {
    successCount: number;
    errors: { data: any, error: string }[];
}

const ImportUsersModal: React.FC<{ isOpen: boolean; onClose: () => void; onImportSuccess: () => void; }> = ({ isOpen, onClose, onImportSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);

    const resetState = () => {
        setFile(null);
        setIsImporting(false);
        setImportResult(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const downloadTemplate = () => {
        const headers = "firstName,surname,email,role,gender,school,faculty,department,level,companyName,companyRole,supervisorCode\n";
        const exampleStudent = "John,Doe,john.doe@example.com,student,Male,Example University,Science,Computer Science,300,,,\n";
        const exampleSupervisor = "Jane,Smith,jane.smith@example.com,supervisor,,,,,,Tech Corp,Lead Engineer,SUPER-ABCDE\n";
        const csvContent = headers + exampleStudent + exampleSupervisor;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'user_import_template.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = async () => {
        if (!file) return;
        setIsImporting(true);
        setImportResult(null);

        const text = await file.text();
        const rows = text.split('\n').filter(row => row.trim() !== '');
        const headers = rows[0].split(',').map(h => h.trim());
        const usersData = rows.slice(1).map(row => {
            const values = row.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
                return obj;
            }, {} as { [key: string]: string });
        });

        const result = await api.bulkCreateUserProfiles(usersData);
        setImportResult(result);
        if (result.successCount > 0) {
            onImportSuccess();
        }
        setIsImporting(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Import Users">
            {!importResult ? (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                        Upload a CSV file to bulk-create user profiles. Each imported user will receive an email to set their password and activate their account.
                    </p>
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                        <h4 className="font-semibold text-gray-800 dark:text-slate-200">Instructions</h4>
                        <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-slate-300 mt-2 space-y-1">
                            <li>Download the CSV template to see the required format.</li>
                            <li>Fill in the user details. Required columns are: `firstName`, `surname`, `email`, `role`.</li>
                            <li>The `role` must be either `student` or `supervisor`.</li>
                            <li>Upload the completed file and click "Import".</li>
                        </ol>
                    </div>
                    <div>
                        <button onClick={downloadTemplate} type="button" className="text-sm font-medium text-primary hover:underline">
                            Download CSV Template
                        </button>
                    </div>
                    <div>
                        <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Upload CSV File</label>
                        <input
                            type="file"
                            id="csv-file"
                            accept=".csv"
                            onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-primary dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500">Cancel</button>
                        <button onClick={handleImport} disabled={!file || isImporting} className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark disabled:opacity-50">
                            {isImporting ? 'Importing...' : 'Start Import'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold dark:text-slate-100">Import Complete</h3>
                    <p className="text-sm text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 p-3 rounded-md">
                        Successfully created {importResult.successCount} new user profiles.
                    </p>
                    {importResult.errors.length > 0 && (
                        <div>
                             <p className="text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">
                                Encountered {importResult.errors.length} errors. These rows were not imported.
                            </p>
                            <div className="mt-2 max-h-48 overflow-y-auto border dark:border-slate-600 rounded-md p-2 space-y-2">
                                {importResult.errors.map((err, index) => (
                                    <div key={index} className="text-xs p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
                                        <p className="font-semibold dark:text-slate-200">Error: <span className="font-normal text-red-500 dark:text-red-400">{err.error}</span></p>
                                        <p className="text-gray-500 dark:text-slate-400 truncate">Data: {JSON.stringify(err.data)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                     <div className="flex justify-end pt-4">
                        <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark">Close</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};


export const AdminUserManagementPage: React.FC = () => {
    const { user: currentUser, isLoading: isAuthLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<'students' | 'supervisors' | 'admins'>('students');
    const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const fetchData = () => {
        setIsLoading(true);
        api.getAllUsers().then(data => {
            setUsers(data);
            setIsLoading(false);
        });
    };

    useEffect(fetchData, []);
    
    const students = useMemo(() => users.filter(u => u.role === UserRole.Student), [users]);
    const supervisors = useMemo(() => users.filter(u => u.role === UserRole.Supervisor), [users]);
    const admins = useMemo(() => users.filter(u => u.role === UserRole.Admin), [users]);
    
    const usersToDisplay = useMemo(() => {
        switch(activeTab) {
            case 'students': return students;
            case 'supervisors': return supervisors;
            case 'admins': return admins;
            default: return [];
        }
    }, [activeTab, students, supervisors, admins]);

    const filteredUsers = useMemo(() => {
        return usersToDisplay.filter(user => {
            const fullName = `${user.firstName} ${user.surname}`;
            return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   user.email.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [usersToDisplay, searchTerm]);
    
    const handleConfirmDelete = async () => {
        if (!userToDelete) return;

        setIsDeleting(true);
        const success = await api.deleteUserAndData(userToDelete.id);
        if (success) {
            setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDelete.id));
        } else {
            setFeedbackMessage({type: 'error', message: "Failed to delete user."});
        }
        setIsDeleting(false);
        setUserToDelete(null);
    };

    const handlePasswordReset = async (user: User) => {
        if (!window.confirm(`Are you sure you want to send a password reset email to ${user.email}?`)) return;
        
        try {
            await sendPasswordResetEmail(auth, user.email);
            setFeedbackMessage({type: 'success', message: `Password reset email sent successfully to ${user.email}.`});
        } catch (error: any) {
            setFeedbackMessage({type: 'error', message: `Failed to send email: ${error.message}`});
        }
        setTimeout(() => setFeedbackMessage(null), 5000);
    };

    const handleExportUsers = async () => {
        setIsExporting(true);
        const allUsers = await api.getAllUsers();
        const headers = ['id', 'firstName', 'surname', 'email', 'role', 'gender', 'school', 'faculty', 'department', 'level', 'supervisorId', 'supervisorCode', 'companyName', 'companyRole'];
        const csvRows = allUsers.map(user =>
            headers.map(header => JSON.stringify((user as any)[header] ?? '', (key, value) => value ?? '')).join(',')
        );
        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `logbook_users_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExporting(false);
    };


    if (isAuthLoading || isLoading) return <div className="text-center p-8">Loading users...</div>;
    
    if (currentUser?.role !== UserRole.Admin) {
        return <Navigate to="/dashboard" replace />;
    }

    const TabButton: React.FC<{ title: string; count: number; value: 'students' | 'supervisors' | 'admins' }> = ({ title, count, value }) => (
        <button
            onClick={() => setActiveTab(value)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === value
                ? 'border-b-2 border-primary text-primary bg-gray-50 dark:bg-slate-700/50'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
            }`}
        >
            {title} <span className="bg-gray-200 dark:bg-slate-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{count}</span>
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="bg-surface dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                     <h2 className="text-xl font-semibold dark:text-slate-100 hidden sm:block">User Management</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsImportModalOpen(true)} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500">Import Users</button>
                        <button onClick={handleExportUsers} disabled={isExporting} className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500 disabled:opacity-50">
                           {isExporting ? 'Exporting...' : 'Export Users'}
                        </button>
                    </div>
                    <input 
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border dark:border-slate-600 rounded-lg w-full sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 dark:text-slate-200"
                    />
                </div>

                {feedbackMessage && (
                    <div className={`mb-4 p-3 rounded-md text-sm ${feedbackMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                        {feedbackMessage.message}
                    </div>
                )}
                
                <div className="border-b border-gray-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <TabButton title="Students" count={students.length} value="students" />
                        <TabButton title="Supervisors" count={supervisors.length} value="supervisors" />
                        <TabButton title="Admins" count={admins.length} value="admins" />
                    </nav>
                </div>
                
                <div className="mt-4">
                    <UserDisplay
                        users={filteredUsers}
                        currentUser={currentUser}
                        onSelectUser={setSelectedUser}
                        onDeleteUser={setUserToDelete}
                        onResetPassword={handlePasswordReset}
                        searchTerm={searchTerm}
                    />
                </div>
            </div>

            <UserDetailsModal user={selectedUser} onClose={() => setSelectedUser(null)} />
            
            <ImportUsersModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImportSuccess={fetchData} />

            <Modal isOpen={!!userToDelete} onClose={() => setUserToDelete(null)} title="Confirm User Deletion">
                <div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                        Are you sure you want to delete the user <strong>{userToDelete?.firstName} {userToDelete?.surname}</strong>?
                        This will permanently delete their account and all associated data (including logs). This action cannot be undone.
                    </p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button 
                            type="button" 
                            onClick={() => setUserToDelete(null)} 
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleConfirmDelete} 
                            disabled={isDeleting}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:opacity-50"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete User'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};