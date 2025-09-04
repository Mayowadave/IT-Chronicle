import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/firebase';
import { Skill, User, UserRole, LogEntry } from '../types';
import Modal from './shared/Modal';
import { AcademicCapIcon, ChevronDownIcon } from './shared/Icons';

interface SkillEvidenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    skill: Skill | null;
    logs: LogEntry[];
}

const SkillEvidenceModal: React.FC<SkillEvidenceModalProps> = ({ isOpen, onClose, skill, logs }) => {
    if (!skill) return null;

    const relevantLogs = logs.filter(log => skill.logIds.includes(log.id));

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Evidence for: ${skill.name}`}>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {relevantLogs.length > 0 ? (
                    relevantLogs.map(log => (
                        <div key={log.id} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                            <p className="font-semibold text-on-surface dark:text-slate-200">
                                Week {log.week}: {log.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                                {new Date(log.date).toDateString()}
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 dark:text-slate-400">No specific log entries found for this skill.</p>
                )}
            </div>
        </Modal>
    );
};

interface SkillDashboardProps {
    student: User;
    skills: Skill[];
    logs: LogEntry[];
    isLoading: boolean;
}

const SkillDashboard: React.FC<SkillDashboardProps> = ({ student, skills, logs, isLoading }) => {
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

    const technicalSkills = useMemo(() => skills.filter(s => s.category === 'technical'), [skills]);
    const softSkills = useMemo(() => skills.filter(s => s.category === 'soft'), [skills]);
    
    const SkillTag: React.FC<{ skill: Skill }> = ({ skill }) => (
        <button
            onClick={() => setSelectedSkill(skill)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900 transition-all transform hover:scale-105"
        >
            {skill.name}
            <span className="text-xs bg-white/60 dark:bg-slate-600/50 px-1.5 py-0.5 rounded-full">{skill.logIds.length}</span>
        </button>
    );

    if (isLoading) {
        return <div className="text-center p-8">Loading skills dashboard...</div>;
    }

    return (
        <div className="space-y-8">
            {skills.length === 0 ? (
                <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-lg border-2 border-dashed dark:border-slate-700">
                    <AcademicCapIcon className="w-12 h-12 mx-auto text-gray-400" />
                    <h3 className="mt-2 text-xl font-semibold dark:text-slate-200">No Skills Identified Yet</h3>
                    <p className="mt-1 text-gray-500 dark:text-slate-400">
                        As logs are approved by the supervisor, this dashboard will automatically populate with demonstrated skills.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-4">Technical Skills</h3>
                        {technicalSkills.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                                {technicalSkills.map(skill => <SkillTag key={skill.id} skill={skill} />)}
                            </div>
                        ) : (
                            <p className="text-gray-500 dark:text-slate-400 text-sm">No technical skills have been identified yet.</p>
                        )}
                    </div>
                     <div className="bg-surface dark:bg-slate-800 p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-200 mb-4">Soft Skills</h3>
                        {softSkills.length > 0 ? (
                             <div className="flex flex-wrap gap-3">
                                {softSkills.map(skill => <SkillTag key={skill.id} skill={skill} />)}
                            </div>
                        ) : (
                            <p className="text-gray-500 dark:text-slate-400 text-sm">No soft skills have been identified yet.</p>
                        )}
                    </div>
                </div>
            )}
            <SkillEvidenceModal
                isOpen={!!selectedSkill}
                onClose={() => setSelectedSkill(null)}
                skill={selectedSkill}
                logs={logs}
            />
        </div>
    );
};


export const SkillsPage: React.FC = () => {
    const { user } = useAuth();
    const [students, setStudents] = useState<User[]>([]);
    const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [skills, setSkills] = useState<Skill[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const selectedStudent = useMemo(() => {
        if (user?.role === UserRole.Student) return user;
        return students.find(s => s.id === selectedStudentId);
    }, [user, students, selectedStudentId]);

    const selectedStudentLogs = useMemo(() => {
        if (!selectedStudentId) return [];
        return allLogs.filter(log => log.studentId === selectedStudentId);
    }, [allLogs, selectedStudentId]);

    // Fetch students list and all their logs for supervisor
    useEffect(() => {
        if (user?.role === UserRole.Supervisor) {
            setIsLoading(true);
            api.getSupervisorDashboardData(user.id).then(({ students: studentData, logs: logData }) => {
                setStudents(studentData);
                setAllLogs(logData);
                if (studentData.length > 0) {
                    setSelectedStudentId(studentData[0].id);
                } else {
                    setIsLoading(false);
                }
            });
        }
    }, [user]);

    // Fetch skills for the selected student (or current user if student)
    useEffect(() => {
        const studentToFetch = user?.role === UserRole.Student ? user : students.find(s => s.id === selectedStudentId);

        if (studentToFetch) {
            setIsLoading(true);
             api.getSkillsForStudent(studentToFetch.id).then((skillData) => {
                setSkills(skillData);
                // If student is a supervisor, we need to also fetch logs for the SkillDashboard
                if (user?.role === UserRole.Student) {
                    api.getLogsForStudent(studentToFetch.id).then(logData => {
                        setAllLogs(logData);
                        setIsLoading(false);
                    });
                } else {
                    setIsLoading(false);
                }
            }).catch(err => {
                console.error("Failed to load skills data", err);
                setIsLoading(false);
            });
        }
    }, [user, selectedStudentId, students]);

    if (user?.role === UserRole.Student) {
        return <SkillDashboard student={user} skills={skills} logs={allLogs} isLoading={isLoading} />;
    }

    if (user?.role === UserRole.Supervisor) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center bg-surface dark:bg-slate-800 p-4 rounded-lg shadow-sm">
                    <h2 className="text-lg font-semibold dark:text-slate-200">Select a Student</h2>
                    <div className="relative w-full sm:w-auto mt-2 sm:mt-0">
                        <select
                            value={selectedStudentId || ''}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            disabled={students.length === 0}
                            className="appearance-none w-full bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-on-surface dark:text-slate-200 py-2 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                        >
                            {students.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.firstName} {s.surname}
                                </option>
                            ))}
                            {students.length === 0 && <option>No students found</option>}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-slate-300">
                           <ChevronDownIcon className="h-4 w-4" />
                        </div>
                    </div>
                </div>

                {selectedStudent ? (
                    <SkillDashboard student={selectedStudent} skills={skills} logs={selectedStudentLogs} isLoading={isLoading} />
                ) : (
                    !isLoading && (
                        <div className="text-center py-12 bg-surface dark:bg-slate-800 rounded-lg border-2 border-dashed dark:border-slate-700">
                             <h3 className="text-xl font-semibold dark:text-slate-200">No Students Found</h3>
                            <p className="text-gray-500 dark:text-slate-400 mt-2">Share your supervisor code to link with students.</p>
                        </div>
                    )
                )}
            </div>
        );
    }
    
    return null; // Or a fallback UI for other roles if necessary
};