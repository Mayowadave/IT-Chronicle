import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { User, LogEntry, LogStatus, UserRole, ItStatus } from '../types';
import Modal from './shared/Modal';
import { ClockIcon, CheckCircleIcon, XCircleIcon, UsersIcon, SparklesIcon } from './shared/Icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// FIX: Changed react-router-dom import to namespace import to fix module resolution issues.
import * as ReactRouterDom from 'react-router-dom';

const { Navigate } = ReactRouterDom;

// =================================================================================
// COMPONENTS FOR THE "MY STUDENTS" PAGE AND LOGS VIEW
// =================================================================================

const LogStatusBadge: React.FC<{ status: LogStatus }> = ({ status }) => {
    const statusStyles = {
        [LogStatus.Pending]: { text: 'Pending', icon: <ClockIcon className="w-4 h-4" />, colors: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
        [LogStatus.Approved]: { text: 'Approved', icon: <CheckCircleIcon className="w-4 h-4" />, colors: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
        [LogStatus.Rejected]: { text: 'Rejected', icon: <XCircleIcon className="w-4 h-4" />, colors: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    };
    const { text, icon, colors } = statusStyles[status];
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>{icon} {text}</span>;
};


const SupervisorLogEntryCard: React.FC<{ 
    log: LogEntry; 
    onUpdate?: (logId: string, status: LogStatus, feedback?: string) => void;
    onAddComment?: (logId: string, comment: string) => void; 
    isReadOnly?: boolean;
}> = ({ log, onUpdate, onAddComment, isReadOnly = false }) => {
    const [isFeedbackModalOpen, setFeedbackModalOpen] = useState(false);
    const [feedback, setFeedback] = useState('');

    const [isCommentModalOpen, setCommentModalOpen] = useState(false);
    const [comment, setComment] = useState(log.feedback || '');

    const [aiInsights, setAiInsights] = useState<{ summary: string; qualityScore: string; feedbackSuggestion: string; } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showInsights, setShowInsights] = useState(false);

    const handleApprove = () => {
        onUpdate?.(log.id, LogStatus.Approved);
    };

    const handleReject = (prefilledFeedback = '') => {
        setFeedback(prefilledFeedback);
        setFeedbackModalOpen(true);
    };
    
    const submitRejection = () => {
        onUpdate?.(log.id, LogStatus.Rejected, feedback);
        setFeedbackModalOpen(false);
        setFeedback('');
    };

    const handleAddComment = () => {
        setComment(log.feedback || '');
        setCommentModalOpen(true);
    };

    const submitComment = () => {
        onAddComment?.(log.id, comment);
        setCommentModalOpen(false);
    };
    
    const handleAnalyzeLog = async () => {
        if (aiInsights) { // If already analyzed, just toggle visibility
            setShowInsights(!showInsights);
            return;
        }
        setIsAnalyzing(true);
        setShowInsights(true); // Show the section immediately with a loader
        const result = await api.analyzeLogEntry(log.content);
        setAiInsights(result);
        setIsAnalyzing(false);
    };


    return (
        <div className="bg-surface dark:bg-slate-800 rounded-lg shadow-md p-5 border border-gray-100 dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-on-surface dark:text-slate-200">{log.title} (Week {log.week})</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{new Date(log.date).toDateString()}</p>
                </div>
                <LogStatusBadge status={log.status} />
            </div>
            {/* FIX: Moved prose classes to wrapper div, as ReactMarkdown does not accept a className prop. */}
            <div className="mt-3 prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {log.content}
                </ReactMarkdown>
            </div>

            {log.feedback && (
                <div className={`mt-3 p-3 border-l-4 ${log.status === LogStatus.Rejected ? 'bg-red-50 dark:bg-red-900/50 border-red-400' : 'bg-blue-50 dark:bg-blue-900/50 border-blue-400'}`}>
                    <p className={`text-sm font-semibold ${log.status === LogStatus.Rejected ? 'text-red-800 dark:text-red-200' : 'text-blue-800 dark:text-blue-200'}`}>
                        {log.status === LogStatus.Rejected ? 'Rejection Feedback' : 'Your Comment'}:
                    </p>
                    <p className={`text-sm italic ${log.status === LogStatus.Rejected ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'}`}>"{log.feedback}"</p>
                </div>
            )}

            {showInsights && (
                <div className="mt-4 p-3 border-t border-dashed border-gray-200 dark:border-slate-700">
                    <h4 className="text-xs font-bold uppercase text-gray-400 dark:text-slate-500 mb-2">AI Insights</h4>
                    {isAnalyzing ? (
                        <p className="text-sm text-gray-500 dark:text-slate-400">Analyzing log entry...</p>
                    ) : aiInsights ? (
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="font-semibold dark:text-slate-200">Summary:</p>
                                <p className="italic text-gray-600 dark:text-slate-300">"{aiInsights.summary}"</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold dark:text-slate-200">Quality Score:</p>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${aiInsights.qualityScore === 'Excellent' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : aiInsights.qualityScore === 'Good' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'}`}>{aiInsights.qualityScore}</span>
                            </div>
                            {aiInsights.feedbackSuggestion && (
                                <div>
                                    <p className="font-semibold dark:text-slate-200">Suggested Feedback:</p>
                                    <p className="italic text-gray-600 dark:text-slate-300">"{aiInsights.feedbackSuggestion}"</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-red-500 dark:text-red-400">Could not analyze log entry.</p>
                    )}
                </div>
            )}

            {!isReadOnly && log.status === LogStatus.Pending && (
                <div className="mt-4 flex justify-end items-center flex-wrap gap-2">
                    <button 
                        onClick={handleAnalyzeLog} 
                        disabled={isAnalyzing}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900 disabled:opacity-60"
                        title="Get an AI-powered analysis of this log entry"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        {isAnalyzing ? 'Analyzing...' : (showInsights ? 'Hide Insights' : 'AI Insights')}
                    </button>
                    <div className="flex-grow"></div>
                    <button onClick={() => handleReject()} className="px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-900">Reject</button>
                    {aiInsights && aiInsights.feedbackSuggestion && showInsights && !isAnalyzing && (
                         <button onClick={() => handleReject(aiInsights.feedbackSuggestion)} className="px-3 py-1 text-sm font-medium text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/60 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/80">
                            Reject w/ Suggestion
                         </button>
                    )}
                    <button onClick={handleApprove} className="px-3 py-1 text-sm font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 rounded-md hover:bg-green-200 dark:hover:bg-green-900">Approve</button>
                </div>
            )}
            
            {!isReadOnly && log.status === LogStatus.Approved && (
                <div className="mt-4 flex justify-end">
                    <button onClick={handleAddComment} className="px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900">
                        {log.feedback ? 'Edit Comment' : 'Add Comment'}
                    </button>
                </div>
            )}

             <Modal isOpen={isFeedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} title="Rejection Feedback">
                <div className="space-y-4">
                    <p className="dark:text-slate-300">Please provide feedback for rejecting the log for Week {log.week}.</p>
                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="e.g., Please provide more detail on task X..."></textarea>
                    <div className="flex justify-end">
                        <button onClick={submitRejection} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">Submit Rejection</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isCommentModalOpen} onClose={() => setCommentModalOpen(false)} title="Add/Edit Comment">
                <div className="space-y-4">
                    <p className="dark:text-slate-300">Add a comment for the log for Week {log.week}.</p>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="e.g., Great work on this task!..."></textarea>
                    <div className="flex justify-end">
                        <button onClick={submitComment} className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark">Save Comment</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const StudentLogsView: React.FC<{ student: User; logs: LogEntry[]; onBack: () => void; refreshData: () => void; }> = ({ student, logs, onBack, refreshData }) => {
    const studentFullName = `${student.firstName} ${student.surname}`;

    const sortedLogs = [...logs].sort((a,b) => b.week - a.week);

    const handleUpdateLog = async (logId: string, status: LogStatus, feedback?: string) => {
        await api.updateLogStatus(logId, status, feedback);
        refreshData(); // Refresh all data from the parent component
    }

    const handleAddComment = async (logId: string, comment: string) => {
        await api.addCommentToLog(logId, comment);
        refreshData(); // Refresh all data from the parent component
    };
    
    return (
        <div>
            <button onClick={onBack} className="mb-6 text-sm text-primary hover:underline">&larr; Back to Student List</button>
            <h2 className="text-2xl font-semibold mb-4 dark:text-slate-100">Logbook for {studentFullName}</h2>
            {sortedLogs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedLogs.map(log => <SupervisorLogEntryCard key={log.id} log={log} onUpdate={handleUpdateLog} onAddComment={handleAddComment} />)}
                </div>
            ) : (
                <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-lg border-2 border-dashed dark:border-slate-700">
                    <h3 className="text-xl font-semibold dark:text-slate-200">{studentFullName} has not submitted any logs yet.</h3>
                </div>
            )}
        </div>
    );
};

const FinalReviewPage: React.FC<{ student: User; onBack: () => void }> = ({ student, onBack }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [supervisorEvaluation, setSupervisorEvaluation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        api.getLogsForStudent(student.id).then(data => {
            setLogs(data.sort((a,b) => a.week - b.week)); // Chronological order
            setIsLoading(false);
        });
    }, [student.id]);

    const handleSubmit = async (action: 'approve' | 'request_changes') => {
        setIsSubmitting(true);
        await api.handleFinalSignOff(student.id, supervisorEvaluation, action);
        setIsSubmitting(false);
        onBack(); // Go back to student list
    };
    
    return (
        <div className="space-y-6">
            <button onClick={onBack} className="text-sm text-primary hover:underline">&larr; Back to Student List</button>
            <div className="bg-surface dark:bg-slate-800 p-6 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold dark:text-slate-100">Final Logbook Review</h2>
                <p className="text-gray-500 dark:text-slate-400">For {student.firstName} {student.surname}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                     <div className="bg-surface dark:bg-slate-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-2">Student's Final Summary</h3>
                        <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-gray-50 dark:bg-slate-700/50 rounded-md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{student.finalSummary || "Not provided."}</ReactMarkdown>
                        </div>
                    </div>
                    <div className="bg-surface dark:bg-slate-800 p-6 rounded-lg shadow-md">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-2">All Log Entries</h3>
                        <div className="space-y-4 max-h-[600px] overflow-y-auto p-2">
                             {isLoading ? <p>Loading logs...</p> : logs.map(log => <SupervisorLogEntryCard key={log.id} log={log} isReadOnly />)}
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-1">
                     <div className="bg-surface dark:bg-slate-800 p-6 rounded-lg shadow-md sticky top-6">
                        <h3 className="text-lg font-semibold dark:text-slate-200 mb-2">Your Final Evaluation</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-3">Provide your overall comments on the student's performance. This will be included in the final report.</p>
                         <textarea 
                            value={supervisorEvaluation}
                            onChange={(e) => setSupervisorEvaluation(e.target.value)}
                            rows={6}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            placeholder="e.g., John Doe was a valuable member of the team..."
                        />
                        <div className="mt-4 space-y-2">
                            <button
                                onClick={() => handleSubmit('approve')}
                                disabled={isSubmitting || !supervisorEvaluation.trim()}
                                className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Submitting...' : 'Approve & Complete IT'}
                            </button>
                             <button
                                onClick={() => handleSubmit('request_changes')}
                                disabled={isSubmitting || !supervisorEvaluation.trim()}
                                className="w-full px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-900 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Submitting...' : 'Request Changes'}
                            </button>
                            <p className="text-xs text-center text-gray-400 dark:text-slate-500">You must provide an evaluation to perform an action.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export const SupervisorStudentsPage: React.FC = () => {
    const { user } = useAuth();
    const [students, setStudents] = useState<User[]>([]);
    const [logsByStudent, setLogsByStudent] = useState<Record<string, LogEntry[]>>({});
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [selectedStudentForReview, setSelectedStudentForReview] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchDashboardData = () => {
        if (user && user.role === UserRole.Supervisor) {
            setIsLoading(true);
            api.getSupervisorDashboardData(user.id).then(({ students: studentData, logs: allLogs }) => {
                 const logsGroupedByStudent = allLogs.reduce((acc, log) => {
                    (acc[log.studentId] = acc[log.studentId] || []).push(log);
                    return acc;
                }, {} as Record<string, LogEntry[]>);

                setLogsByStudent(logsGroupedByStudent);

                if (studentData.length > 0) {
                    const studentsWithStatus = studentData.map(student => {
                        const studentLogs = logsGroupedByStudent[student.id] || [];
                        const hasPendingLogs = studentLogs.some(log => log.status === LogStatus.Pending);
                        return { ...student, hasPendingLogs };
                    });

                    studentsWithStatus.sort((a, b) => {
                        if (a.itStatus === ItStatus.AwaitingApproval && b.itStatus !== ItStatus.AwaitingApproval) return -1;
                        if (a.itStatus !== ItStatus.AwaitingApproval && b.itStatus === ItStatus.AwaitingApproval) return 1;
                        if ((a as any).hasPendingLogs && !(b as any).hasPendingLogs) return -1;
                        if (!(a as any).hasPendingLogs && (b as any).hasPendingLogs) return 1;
                        const nameA = `${a.firstName} ${a.surname}`;
                        const nameB = `${b.firstName} ${b.surname}`;
                        return nameA.localeCompare(nameB);
                    });
                    
                    setStudents(studentsWithStatus);
                } else {
                    setStudents([]);
                }
                setIsLoading(false);
            }).catch(err => {
                console.error("Failed to load students", err);
                setIsLoading(false);
            });
        } else if (user) {
            setIsLoading(false);
        }
    };
    
    useEffect(fetchDashboardData, [user]);

    const handleBack = () => {
        setSelectedStudent(null);
        setSelectedStudentForReview(null);
        fetchDashboardData(); // Re-fetch to update status badges
    };

    // Role-based redirect
    if (user && user.role !== UserRole.Supervisor && !isLoading) {
        return <Navigate to="/dashboard" replace />;
    }

    if(selectedStudentForReview) {
        return <FinalReviewPage student={selectedStudentForReview} onBack={handleBack} />;
    }
    
    if(selectedStudent) {
        return <StudentLogsView student={selectedStudent} logs={logsByStudent[selectedStudent.id] || []} onBack={handleBack} refreshData={fetchDashboardData}/>;
    }

    if (isLoading) return <div className="text-center p-8">Loading students...</div>;

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {students.map(student => (
                    <div 
                        key={student.id} 
                        onClick={() => student.itStatus === ItStatus.AwaitingApproval ? setSelectedStudentForReview(student) : setSelectedStudent(student)} 
                        className={`relative bg-surface dark:bg-slate-800 rounded-lg shadow-md p-5 border text-center cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all
                            ${student.itStatus === ItStatus.AwaitingApproval ? 'border-yellow-400 dark:border-yellow-500 border-2' : 'border-gray-100 dark:border-slate-700'}`}
                    >
                        {(student as any).hasPendingLogs && student.itStatus !== ItStatus.AwaitingApproval && (
                            <span className="absolute top-3 right-3 flex h-3 w-3" title="Pending logs for review">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                            </span>
                        )}
                        {student.itStatus === ItStatus.AwaitingApproval && (
                            <div className="absolute top-2 -right-2 transform text-xs bg-yellow-400 dark:bg-yellow-500 text-yellow-900 dark:text-yellow-100 font-bold px-2 py-1 rounded-full shadow-md">
                                REVIEW REQUIRED
                            </div>
                        )}
                        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
                            {student.avatarUrl ? (
                                <img src={student.avatarUrl} alt={`${student.firstName} ${student.surname}`} className="w-20 h-20 rounded-full object-cover" />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-white font-bold text-3xl select-none">
                                    {student.firstName?.[0]}{student.surname?.[0]}
                                </div>
                            )}
                        </div>
                        <h3 className="font-semibold text-lg dark:text-slate-200">{student.firstName} {student.surname}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{student.email}</p>
                    </div>
                ))}
            </div>
             {students.length === 0 && !isLoading && (
                <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-lg border-2 border-dashed dark:border-slate-700">
                    <h3 className="text-xl font-semibold dark:text-slate-200">No Students Found</h3>
                    <p className="text-gray-500 dark:text-slate-400 mt-2">Share your supervisor code with students to link them to your account.</p>
                </div>
            )}
        </div>
    );
};

// =================================================================================
// SUPERVISOR DASHBOARD COMPONENT
// =================================================================================

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: number; color: string }> = ({ icon, title, value, color }) => (
    <div className={`bg-surface dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4 border-l-4 ${color}`}>
        <div className="flex-shrink-0">{icon}</div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-on-surface dark:text-slate-100">{value}</p>
        </div>
    </div>
);

export const SupervisorDashboard: React.FC = () => {
    const { user } = useAuth();
    const [students, setStudents] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ approved: 0, pending: 0, rejected: 0 });

    useEffect(() => {
        if (user && user.role === UserRole.Supervisor) {
            setIsLoading(true);
            api.getSupervisorDashboardData(user.id).then(({ students: studentData, logs: allLogs }) => {
                setStudents(studentData);
                if (allLogs.length > 0) {
                    const approved = allLogs.filter(l => l.status === LogStatus.Approved).length;
                    const pending = allLogs.filter(l => l.status === LogStatus.Pending).length;
                    const rejected = allLogs.filter(l => l.status === LogStatus.Rejected).length;
                    setStats({ approved, pending, rejected });
                }
                setIsLoading(false);
            }).catch(err => {
                console.error("Failed to load supervisor dashboard data", err);
                setIsLoading(false);
            });
        }
    }, [user]);

    if (isLoading) return <div className="text-center p-8">Loading dashboard...</div>;

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<UsersIcon className="w-10 h-10 text-blue-500" />} title="Total Students" value={students.length} color="border-blue-500" />
                <StatCard icon={<CheckCircleIcon className="w-10 h-10 text-green-500" />} title="Logs Approved" value={stats.approved} color="border-green-500" />
                <StatCard icon={<ClockIcon className="w-10 h-10 text-yellow-500" />} title="Logs Pending" value={stats.pending} color="border-yellow-500" />
                <StatCard icon={<XCircleIcon className="w-10 h-10 text-red-500" />} title="Logs Rejected" value={stats.rejected} color="border-red-500" />
            </div>

            <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-semibold mb-2 dark:text-slate-100">Welcome, {user?.firstName}!</h2>
                <p className="text-gray-600 dark:text-slate-400 mb-4">This is your dashboard. You can get a quick overview of your students' logbook submissions here. Use the "My Students" page in the sidebar to view and manage individual student logs.</p>
                
                <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg border dark:border-blue-500/30 border-blue-200 mt-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">Your unique Supervisor Code is:</p>
                    <p className="font-mono text-2xl font-bold text-blue-900 dark:text-blue-100 tracking-widest">{user?.supervisorCode || 'N/A'}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Share this code with your students to link them to your account.</p>
                </div>
            </div>
        </div>
    );
};