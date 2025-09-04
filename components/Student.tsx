import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { LogEntry, LogStatus, User, UserRole, ItStatus } from '../types';
import Modal from './shared/Modal';
import { PlusCircleIcon, ClockIcon, CheckCircleIcon, XCircleIcon, DocumentTextIcon, UsersIcon, ChevronDownIcon, DocumentDownloadIcon, SparklesIcon } from './shared/Icons';
// FIX: Changed react-router-dom import to namespace import to fix module resolution issues.
import * as ReactRouterDom from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';

const { Navigate, Link } = ReactRouterDom;

const LogStatusBadge: React.FC<{ status: LogStatus }> = ({ status }) => {
    const statusStyles = {
        [LogStatus.Pending]: { text: 'Pending', icon: <ClockIcon className="w-4 h-4" />, colors: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
        [LogStatus.Approved]: { text: 'Approved', icon: <CheckCircleIcon className="w-4 h-4" />, colors: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
        [LogStatus.Rejected]: { text: 'Rejected', icon: <XCircleIcon className="w-4 h-4" />, colors: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    };
    const { text, icon, colors } = statusStyles[status];
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>{icon} {text}</span>;
};

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: number | string; color: string }> = ({ icon, title, value, color }) => (
    <div className={`bg-surface dark:bg-slate-800 p-5 rounded-xl shadow-md flex items-center space-x-4 border-l-4 ${color}`}>
        <div className="flex-shrink-0">{icon}</div>
        <div>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-on-surface dark:text-slate-100">{value}</p>
        </div>
    </div>
);

const FinalSummaryModal: React.FC<{ onClose: () => void; onSubmit: (summary: string) => void; isLoading: boolean; logs: LogEntry[] }> = ({ onClose, onSubmit, isLoading, logs }) => {
    const [summary, setSummary] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(summary);
    };

    const handleGenerateSummary = async () => {
        setIsGenerating(true);
        try {
            const approvedLogs = logs.filter(log => log.status === LogStatus.Approved);
            const logContents = approvedLogs
                .sort((a, b) => a.week - b.week)
                .map(log => `Week ${log.week}: ${log.title}\n${log.content}`)
                .join('\n\n---\n\n');
            
            if (logContents) {
                const generatedSummary = await api.generateFinalSummary(logContents);
                setSummary(generatedSummary);
            } else {
                setSummary("No approved logs found to generate a summary from.");
            }
        } catch (error) {
            console.error(error);
            setSummary("Failed to generate summary. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <div className="flex justify-between items-center">
                    <div>
                        <label htmlFor="final-summary" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                            Final Summary & Reflection
                        </label>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 mb-2">
                            Summarize your overall industrial training experience.
                        </p>
                    </div>
                     <button
                        type="button"
                        onClick={handleGenerateSummary}
                        disabled={isGenerating || isLoading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-primary dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors disabled:opacity-60"
                    >
                        <SparklesIcon className="w-4 h-4" />
                        {isGenerating ? 'Generating...' : 'Generate Draft with AI'}
                    </button>
                </div>
                <textarea
                    id="final-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={8}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200"
                    placeholder="Reflect on your journey... or let AI help you draft a summary based on your approved logs."
                />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                <button type="submit" disabled={isLoading || isGenerating || !summary.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark disabled:opacity-50">
                    {isLoading ? 'Submitting...' : 'Submit for Final Review'}
                </button>
            </div>
        </form>
    );
};

const generateFinalReportPDF = (student: User, supervisor: User, logs: LogEntry[]) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageHeight = doc.internal.pageSize.height;
    let yPos = 0;

    const checkAndAddPage = (requiredHeight: number) => {
        if (yPos + requiredHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
        }
    };

    // --- Title Page ---
    doc.setFont('times', 'normal');
    doc.setFontSize(28);
    doc.text('Industrial Training Final Report', 105, 60, { align: 'center' });
    
    doc.setFontSize(20);
    doc.text(`${student.firstName} ${student.surname}`, 105, 90, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`${student.school || 'N/A'}`, 105, 100, { align: 'center' });
    doc.text(`Department of ${student.department || 'N/A'}`, 105, 107, { align: 'center' });

    doc.setFont('times', 'bold');
    doc.text('Submitted To:', 105, 150, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text(`${supervisor.firstName} ${supervisor.surname}`, 105, 157, { align: 'center' });
    doc.text(`${supervisor.companyRole || 'Supervisor'} at ${supervisor.companyName || 'N/A'}`, 105, 164, { align: 'center' });
    
    doc.setFont('times', 'italic');
    doc.setFontSize(12);
    doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 105, 200, { align: 'center' });


    // --- Student's Summary Page ---
    doc.addPage();
    yPos = margin;
    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.text("Student's Final Summary & Reflection", margin, yPos);
    yPos += 15;
    
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const summaryLines = doc.splitTextToSize(student.finalSummary || 'No summary provided.', 170);
    doc.text(summaryLines, margin, yPos);


    // --- Supervisor's Evaluation Page ---
    doc.addPage();
    yPos = margin;
    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.text("Supervisor's Final Evaluation", margin, yPos);
    yPos += 15;

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    const evalLines = doc.splitTextToSize(student.supervisorEvaluation || 'No evaluation provided.', 170);
    doc.text(evalLines, margin, yPos);
    yPos += (evalLines.length * 7) + 30;

    checkAndAddPage(40);
    doc.text('_________________________', margin, yPos);
    yPos += 7;
    doc.setFont('times', 'bold');
    doc.text(`Approved By: ${supervisor.firstName} ${supervisor.surname}`, margin, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);

    // --- Log Entries ---
    const logsToExport = [...logs].filter(l => l.status === LogStatus.Approved).sort((a,b) => a.week - b.week);
    if (logsToExport.length > 0) doc.addPage();
    yPos = margin;
    
    logsToExport.forEach((log, index) => {
        const titleLineHeight = 8;
        const contentLineHeight = 7;
        const dateLineHeight = 6;
        const spacing = 5;

        doc.setFont('times', 'bold');
        doc.setFontSize(16);
        const titleLines = doc.splitTextToSize(`Week ${log.week}: ${log.title}`, 170);
        checkAndAddPage(titleLineHeight * titleLines.length + dateLineHeight + spacing * 2 + 20);
        
        doc.text(titleLines, margin, yPos);
        yPos += titleLines.length * titleLineHeight;
        
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(new Date(log.date).toDateString(), margin, yPos);
        yPos += dateLineHeight + spacing;
        
        doc.setTextColor(0);
        doc.setFont('times', 'normal');
        doc.setFontSize(12);
        
        const contentLines = doc.splitTextToSize(log.content, 170); 
        checkAndAddPage(contentLines.length * contentLineHeight);
        doc.text(contentLines, margin, yPos);
        yPos += contentLines.length * contentLineHeight;
        
        if (log.feedback) {
            yPos += spacing;
            checkAndAddPage(20);
            doc.setFont('times', 'italic');
            doc.setTextColor(100);
            const feedbackLines = doc.splitTextToSize(`Supervisor Comment: "${log.feedback}"`, 165);
            doc.text(feedbackLines, margin + 5, yPos);
            yPos += feedbackLines.length * contentLineHeight;
            doc.setTextColor(0);
        }
        
        if (index < logs.length - 1) {
            yPos += spacing;
            checkAndAddPage(10);
            doc.setDrawColor(200);
            doc.line(margin, yPos, 190, yPos);
            yPos += 10;
        }
    });

    doc.save(`${student.firstName}_${student.surname}_Final_Report.pdf`);
};

const LinkSupervisorForm: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [supervisorCode, setSupervisorCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !supervisorCode.trim()) return;
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        
        const result = await api.linkStudentToSupervisor(user.id, supervisorCode.trim());
        
        if (result.success && result.user) {
            setSuccess(result.message);
            updateUser(result.user); // This will re-render the dashboard and hide the form
        } else {
            setError(result.message);
        }
        setIsLoading(false);
    };

    return (
        <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md border-t-4 border-primary">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-2">Link to Your Supervisor</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                Please enter the unique code provided by your industrial training supervisor to link your accounts. You won't be able to submit log entries until this is complete.
            </p>
            {error && <div className="mb-4 bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300 px-4 py-3 rounded-md text-sm">{error}</div>}
            {success && <div className="mb-4 bg-green-100 border border-green-400 text-green-700 dark:bg-green-900/50 dark:border-green-500/50 dark:text-green-300 px-4 py-3 rounded-md text-sm">{success}</div>}
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
                <input
                    type="text"
                    placeholder="Enter Supervisor Code"
                    value={supervisorCode}
                    onChange={(e) => setSupervisorCode(e.target.value.toUpperCase())}
                    required
                    className="flex-grow px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                />
                <button type="submit" disabled={isLoading} className="bg-primary text-white font-semibold px-6 py-2 rounded-lg shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50">
                    {isLoading ? 'Linking...' : 'Link Account'}
                </button>
            </form>
        </div>
    );
};

export const StudentDashboard: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [supervisor, setSupervisor] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFinalizeModalOpen, setFinalizeModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitConfirmModalOpen, setSubmitConfirmModalOpen] = useState(false);
    const [isCancelConfirmModalOpen, setCancelConfirmModalOpen] = useState(false);
    const [pendingSummary, setPendingSummary] = useState('');

    useEffect(() => {
        if (user && user.role === UserRole.Student) {
            setIsLoading(true);
            Promise.all([
                api.getLogsForStudent(user.id),
                user.supervisorId ? api.getUserById(user.supervisorId) : Promise.resolve(null)
            ]).then(([logsData, supervisorData]) => {
                setLogs(logsData);
                setSupervisor(supervisorData);
                setIsLoading(false);
            }).catch(err => {
                console.error("Failed to load student dashboard data", err);
                setIsLoading(false);
            });
        } else if (user) {
            setIsLoading(false);
        }
    }, [user]);

    const handleRequestFinalize = (summary: string) => {
        setPendingSummary(summary);
        setFinalizeModalOpen(false);
        setSubmitConfirmModalOpen(true);
    };

    const handleConfirmFinalSubmit = async () => {
        if (!user || !pendingSummary) return;
        setIsSubmitting(true);
        setSubmitConfirmModalOpen(false);
        const updatedUser = await api.requestFinalReview(user.id, pendingSummary);
        if (updatedUser) {
            updateUser(updatedUser);
        }
        setIsSubmitting(false);
        setPendingSummary('');
    };
    
    const handleCancelSubmission = async () => {
        if (!user) return;
        setIsSubmitting(true);
        setCancelConfirmModalOpen(false);
        const updatedUser = await api.cancelFinalReview(user.id);
        if (updatedUser) {
            updateUser(updatedUser);
        }
        setIsSubmitting(false);
    };

    const handleDownloadFinalReport = () => {
        if (user && supervisor && logs) {
            generateFinalReportPDF(user, supervisor, logs);
        }
    };
    
    if (isLoading) return <div className="text-center p-8">Loading dashboard...</div>;
    
    if (user?.role !== UserRole.Student) {
        return <Navigate to="/login" />;
    }

    const stats = {
        total: logs.length,
        approved: logs.filter(l => l.status === LogStatus.Approved).length,
        pending: logs.filter(l => l.status === LogStatus.Pending).length,
        rejected: logs.filter(l => l.status === LogStatus.Rejected).length,
    };
    
    const effectiveItStatus = user?.itStatus || ItStatus.Ongoing;
    const canSubmitForReview = logs.length > 0 && stats.total === stats.approved;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100">Welcome, {user?.firstName}!</h1>
                <p className="mt-1 text-gray-600 dark:text-slate-400">Here's a summary of your industrial training progress.</p>
            </div>

            {!user?.supervisorId && effectiveItStatus === ItStatus.Ongoing && (
                <LinkSupervisorForm />
            )}

            {user?.supervisorId && (
                <>
                    {effectiveItStatus === ItStatus.Ongoing && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/50 border-l-4 border-yellow-400 dark:border-yellow-500 text-yellow-800 dark:text-yellow-200 p-4 rounded-md" role="alert">
                          <p className="font-bold">Next Step</p>
                          <p>
                            {stats.rejected > 0
                                ? "You have rejected logs that require attention. Please review the feedback from your supervisor and update them before you can finalize."
                                : canSubmitForReview
                                    ? "All your logs have been approved. You can now submit your logbook for final review."
                                    : stats.pending > 0 
                                        ? "You have logs pending supervisor approval. You can finalize your logbook once all entries are approved."
                                        : "Continue to submit your weekly logs. Once all logs are submitted and approved, you will be able to finalize your logbook."}
                          </p>
                        </div>
                    )}
                    {effectiveItStatus === ItStatus.AwaitingApproval && (
                        <div className="bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-400 dark:border-blue-500 text-blue-800 dark:text-blue-200 p-4 rounded-md" role="alert">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div>
                                    <p className="font-bold">Status: Awaiting Final Supervisor Approval</p>
                                    <p>Your logbook has been submitted for final review. Your supervisor has been notified.</p>
                                </div>
                                <button
                                    onClick={() => setCancelConfirmModalOpen(true)}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-red-700 disabled:opacity-50"
                                >
                                    Cancel Submission
                                </button>
                            </div>
                        </div>
                    )}
                     {effectiveItStatus === ItStatus.Completed && (
                        <div className="bg-green-50 dark:bg-green-900/50 border-l-4 border-green-400 dark:border-green-500 text-green-800 dark:text-green-200 p-4 rounded-md" role="alert">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div>
                                    <p className="font-bold">Congratulations! Your IT is marked as complete.</p>
                                    <p>Your supervisor has signed off on your logbook. You can now download the final report.</p>
                                </div>
                                <button onClick={handleDownloadFinalReport} className="w-full sm:w-auto mt-2 sm:mt-0 flex-shrink-0 bg-green-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-green-700">
                                   Download Final Report
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard icon={<DocumentTextIcon className="w-10 h-10 text-blue-500" />} title="Total Logs" value={stats.total} color="border-blue-500" />
                        <StatCard icon={<CheckCircleIcon className="w-10 h-10 text-green-500" />} title="Approved" value={stats.approved} color="border-green-500" />
                        <StatCard icon={<ClockIcon className="w-10 h-10 text-yellow-500" />} title="Pending" value={stats.pending} color="border-yellow-500" />
                        <StatCard icon={<XCircleIcon className="w-10 h-10 text-red-500" />} title="Rejected" value={stats.rejected} color="border-red-500" />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <div className="lg:col-span-1">
                            {supervisor && (
                                 <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md h-full">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-4 flex items-center">
                                       <UsersIcon className="w-6 h-6 mr-2 text-primary" />
                                        Your Supervisor
                                    </h3>
                                    <div className="flex items-center space-x-4">
                                        {supervisor.avatarUrl ? (
                                            <img src={supervisor.avatarUrl} alt={`${supervisor.firstName} ${supervisor.surname}`} className="w-16 h-16 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-primary-dark flex items-center justify-center text-white font-bold text-2xl select-none">
                                                {supervisor.firstName?.[0]}{supervisor.surname?.[0]}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-slate-100">{supervisor.firstName} {supervisor.surname}</p>
                                            <p className="text-sm text-gray-500 dark:text-slate-400">{supervisor.email}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                         <div className="lg:col-span-2">
                            <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md h-full">
                                 <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200">Recent Activity</h3>
                                    {effectiveItStatus === ItStatus.Ongoing && canSubmitForReview && (
                                        <button
                                            onClick={() => setFinalizeModalOpen(true)}
                                            className="bg-primary text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-primary-dark transition-colors"
                                        >
                                            Finalize & Request Review
                                        </button>
                                    )}
                                 </div>
                                 {logs.slice(0, 3).map(log => (
                                     <div key={log.id} className="border-b dark:border-slate-700 last:border-b-0 py-3">
                                         <div className="flex justify-between items-center">
                                             <p className="font-semibold dark:text-slate-200">{log.title} (Week {log.week})</p>
                                             <LogStatusBadge status={log.status} />
                                         </div>
                                         <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{new Date(log.date).toDateString()}</p>
                                     </div>
                                 ))}
                                 {logs.length === 0 && <p className="text-gray-500 dark:text-slate-400">No recent activity.</p>}
                            </div>
                        </div>
                    </div>
                </>
            )}
            <Modal isOpen={isFinalizeModalOpen} onClose={() => setFinalizeModalOpen(false)} title="Finalize and Submit Logbook">
                <FinalSummaryModal 
                    onClose={() => setFinalizeModalOpen(false)} 
                    onSubmit={handleRequestFinalize} 
                    isLoading={isSubmitting} 
                    logs={logs}
                />
            </Modal>
            
            <Modal isOpen={isSubmitConfirmModalOpen} onClose={() => setSubmitConfirmModalOpen(false)} title="Confirm Submission">
                <div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">Are you sure you want to submit your logbook for final review? You will not be able to make any changes unless your supervisor requests them.</p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={() => setSubmitConfirmModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                        <button onClick={handleConfirmFinalSubmit} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark disabled:opacity-50">
                            {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isCancelConfirmModalOpen} onClose={() => setCancelConfirmModalOpen(false)} title="Cancel Submission">
                 <div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">Are you sure you want to cancel your final review submission? Your logbook status will revert to 'Ongoing' and you will be able to edit your logs again.</p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={() => setCancelConfirmModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500">Keep Submitted</button>
                        <button onClick={handleCancelSubmission} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:opacity-50">
                            {isSubmitting ? 'Canceling...' : 'Yes, Cancel Submission'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};


interface LogEntryCardProps {
    log: LogEntry;
    onEdit: (log: LogEntry) => void;
    onDelete: (logId: string) => void;
    isLocked: boolean;
}

const LogEntryCard: React.FC<LogEntryCardProps> = ({ log, onEdit, onDelete, isLocked }) => {
    return (
        <div className="bg-surface dark:bg-slate-800 rounded-lg shadow-md hover:shadow-lg transition-shadow p-5 border border-gray-100 dark:border-slate-700/50 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-sm font-semibold text-primary">Week {log.week}</p>
                        <h3 className="text-lg font-bold text-on-surface dark:text-slate-100 leading-tight mt-1">{log.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{new Date(log.date).toDateString()}</p>
                    </div>
                    <LogStatusBadge status={log.status} />
                </div>
                {/* FIX: Moved prose classes to wrapper div, as ReactMarkdown does not accept a className prop. */}
                 <div className="mt-3 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {log.content}
                    </ReactMarkdown>
                </div>
                {log.attachments && log.attachments.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400">Attachments</h4>
                        {log.attachments.map(att => (
                            <a key={att.name} href={att.url} className="text-sm text-primary hover:underline block">{att.name}</a>
                        ))}
                    </div>
                )}
                {(log.status === LogStatus.Rejected || (log.status === LogStatus.Approved && log.feedback)) && (
                   <div className={`mt-3 p-3 border-l-4 ${
                       log.status === LogStatus.Rejected 
                       ? 'bg-red-50 dark:bg-red-900/50 border-red-400 dark:border-red-500'
                       : 'bg-blue-50 dark:bg-blue-900/50 border-blue-400 dark:border-blue-500'
                   }`}>
                       <p className={`text-sm font-semibold ${
                           log.status === LogStatus.Rejected 
                           ? 'text-red-800 dark:text-red-200'
                           : 'text-blue-800 dark:text-blue-200'
                       }`}>
                           Supervisor {log.status === LogStatus.Rejected ? 'Feedback' : 'Comment'}:
                       </p>
                       <p className={`text-sm italic ${
                           log.status === LogStatus.Rejected
                           ? 'text-red-700 dark:text-red-300'
                           : 'text-blue-700 dark:text-blue-300'
                       }`}>"{log.feedback}"</p>
                   </div>
                )}
            </div>
            {!isLocked && log.status !== LogStatus.Approved && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end space-x-2">
                    <button onClick={() => onEdit(log)} className="px-3 py-1 text-sm font-medium text-primary-dark dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors">Edit</button>
                    <button onClick={() => onDelete(log.id)} className="px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-900 transition-colors">Delete</button>
                </div>
            )}
        </div>
    );
};

interface NewLogEntryFormProps {
    onClose: () => void;
    onLogSaved: (savedLog: LogEntry) => void;
    logToEdit?: LogEntry | null;
}

const NewLogEntryForm: React.FC<NewLogEntryFormProps> = ({ onClose, onLogSaved, logToEdit }) => {
    const { user } = useAuth();
    const [week, setWeek] = useState(1);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewMode, setViewMode] = useState<'write' | 'preview'>('write');
    
    const isEditMode = !!logToEdit;

    useEffect(() => {
        if (logToEdit) {
            setWeek(logToEdit.week);
            setTitle(logToEdit.title);
            setContent(logToEdit.content);
        } else {
            // Reset form for new entry
            setWeek(1);
            setTitle('');
            setContent('');
            setAttachment(null);
        }
    }, [logToEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !content || !title) return;
        setIsLoading(true);

        if (isEditMode && logToEdit) {
            const updatedData: Partial<LogEntry> = {
                week,
                title,
                content,
                attachments: attachment ? [{ name: attachment.name, url: '#' }] : logToEdit.attachments || [],
            };
            const updatedLog = await api.updateLog(logToEdit.id, updatedData);
            if (updatedLog) onLogSaved(updatedLog);
        } else {
            const newLogData: Omit<LogEntry, 'id' | 'status' | 'feedback'> = {
                studentId: user.id,
                date: new Date().toISOString(),
                week,
                title,
                content,
                attachments: attachment ? [{ name: attachment.name, url: '#' }] : [],
            };
            const newLog = await api.createLog(newLogData);
            onLogSaved(newLog);
        }
        setIsLoading(false);
        onClose();
    };
    
    const handleGenerateContent = async () => {
        if (!title.trim() && !content.trim()) return;
        setIsGenerating(true);
        const generatedContent = await api.generateLogEntry(week, title, content);
        setContent(generatedContent);
        setIsGenerating(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="week" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Week</label>
                    <input type="number" id="week" value={week} onChange={(e) => setWeek(Number(e.target.value))} min="1" required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" />
                </div>
                 <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Title</label>
                    <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" placeholder="e.g., Onboarding & Initial Setup" />
                </div>
            </div>

            <div>
                 <div className="flex justify-between items-center mb-1">
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                        Log Entry Details
                    </label>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={handleGenerateContent}
                            disabled={isGenerating || (!title.trim() && !content.trim())}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-primary dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors disabled:opacity-60"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            {isGenerating ? 'Generating...' : 'Enhance with AI'}
                        </button>
                        <div className="flex rounded-md bg-gray-100 dark:bg-slate-900 p-0.5">
                             <button type="button" onClick={() => setViewMode('write')} className={`px-2 py-0.5 text-xs rounded ${viewMode === 'write' ? 'bg-white dark:bg-slate-700 shadow' : 'text-gray-600 dark:text-slate-400'}`}>Write</button>
                             <button type="button" onClick={() => setViewMode('preview')} className={`px-2 py-0.5 text-xs rounded ${viewMode === 'preview' ? 'bg-white dark:bg-slate-700 shadow' : 'text-gray-600 dark:text-slate-400'}`}>Preview</button>
                        </div>
                    </div>
                </div>
                 {viewMode === 'write' ? (
                     <textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} required className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-700 dark:text-slate-200" placeholder="Describe your activities for the week. You can use Markdown for formatting (e.g., # heading, *italic*, **bold**, - list item)."></textarea>
                 ) : (
                     <div className="prose prose-sm dark:prose-invert max-w-none p-3 border border-gray-200 dark:border-slate-600 rounded-md min-h-[200px] bg-gray-50 dark:bg-slate-700/50">
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "Nothing to preview yet."}</ReactMarkdown>
                     </div>
                 )}
            </div>
             <div>
                <label htmlFor="attachment" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Attachment (Optional)</label>
                <input type="file" id="attachment" onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/50 file:text-primary dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900"/>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md shadow-sm hover:bg-primary-dark disabled:opacity-50">{isLoading ? 'Saving...' : 'Save Log'}</button>
            </div>
        </form>
    );
};

export const StudentLogsPage: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [logToEdit, setLogToEdit] = useState<LogEntry | null>(null);
    const [logToDeleteId, setLogToDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchLogs();
        }
    }, [user]);

    const fetchLogs = async () => {
        if (!user) return;
        setIsLoading(true);
        const data = await api.getLogsForStudent(user.id);
        setLogs(data);
        setIsLoading(false);
    };

    const handleLogSaved = (savedLog: LogEntry) => {
        const index = logs.findIndex(l => l.id === savedLog.id);
        if (index > -1) {
            setLogs(logs.map(l => l.id === savedLog.id ? savedLog : l));
        } else {
            setLogs([savedLog, ...logs]);
        }
    };

    const handleOpenEditModal = (log: LogEntry) => {
        setLogToEdit(log);
        setIsModalOpen(true);
    };
    
    const handleOpenNewModal = () => {
        setLogToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleDelete = async () => {
        if (logToDeleteId) {
            await api.deleteLog(logToDeleteId);
            setLogs(logs.filter(l => l.id !== logToDeleteId));
            setLogToDeleteId(null);
        }
    };

    const isLocked = user?.itStatus === ItStatus.AwaitingApproval || user?.itStatus === ItStatus.Completed;

    if (isLoading) return <div className="text-center p-8">Loading logs...</div>;

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface dark:bg-slate-800 p-4 rounded-lg shadow-sm">
                <div>
                     <p className="font-semibold dark:text-slate-200">
                        {isLocked
                            ? "Your logbook is locked for review."
                            : "Manage your weekly industrial training log entries here."}
                    </p>
                    {isLocked && <p className="text-sm text-gray-500 dark:text-slate-400">You cannot add or edit logs while your logbook is submitted for final review.</p>}
                </div>
                {!isLocked && (
                    <button onClick={handleOpenNewModal} className="flex-shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                        <PlusCircleIcon className="w-5 h-5" />
                        Add New Log
                    </button>
                )}
            </div>
            
            {logs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {logs.map(log => (
                        <LogEntryCard key={log.id} log={log} onEdit={handleOpenEditModal} onDelete={setLogToDeleteId} isLocked={isLocked} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-lg border-2 border-dashed dark:border-slate-700">
                    <DocumentTextIcon className="w-12 h-12 mx-auto text-gray-400" />
                    <h3 className="mt-2 text-xl font-semibold dark:text-slate-200">No Log Entries Yet</h3>
                    <p className="mt-1 text-gray-500 dark:text-slate-400">Click "Add New Log" to get started.</p>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={logToEdit ? 'Edit Log Entry' : 'New Log Entry'}>
                <NewLogEntryForm 
                    onClose={() => setIsModalOpen(false)}
                    onLogSaved={handleLogSaved}
                    logToEdit={logToEdit}
                />
            </Modal>
            
             <Modal isOpen={!!logToDeleteId} onClose={() => setLogToDeleteId(null)} title="Confirm Deletion">
                <div>
                    <p className="text-sm text-gray-700 dark:text-slate-300">Are you sure you want to delete this log entry? This action cannot be undone.</p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button type="button" onClick={() => setLogToDeleteId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500">
                            Cancel
                        </button>
                        <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">
                            Delete
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
