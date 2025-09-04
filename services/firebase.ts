// FIX: Corrected import paths for Firebase to use scoped packages, resolving module export errors.
import { initializeApp } from "@firebase/app";
// FIX: Imported auth functions needed for bulk user creation.
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "@firebase/auth";
import { getDatabase, ref, get, set, push, update, remove, query, orderByChild, equalTo } from "@firebase/database";
// FIX: Imported the new 'Skill' type to be used in the new function.
import { User, LogEntry, UserRole, LogStatus, Notification, ItStatus, Skill, Announcement, ProgramCycle, SystemEvent, BrandingSettings } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyA16cdFbZsqg9oVAwGr-zV3JzThDq96pzo",
  authDomain: "it-chronicle-45c15.firebaseapp.com",
  databaseURL: "https://it-chronicle-45c15-default-rtdb.firebaseio.com",
  projectId: "it-chronicle-45c15",
  storageBucket: "it-chronicle-45c15.appspot.com",
  messagingSenderId: "935601332723",
  appId: "1:935601332723:web:c281c4019030893edc3286",
  measurementId: "G-VG076K9RDW"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getDatabase(app);

// --- Helper Functions ---
const snapshotToArr = <T>(snapshot: any): T[] => {
    const items: T[] = [];
    if (snapshot.exists()) {
        snapshot.forEach((child: any) => {
            items.push({ id: child.key, ...child.val() } as T);
        });
    }
    return items;
};

const snapshotToObj = <T>(snapshot: any): T | null => {
    if (snapshot.exists()) {
        return { id: snapshot.key, ...snapshot.val() } as T;
    }
    return null;
};

// --- API ---
export const api = {
    // --- AI Features ---
    analyzeLogEntry: async (logContent: string): Promise<{ summary: string; qualityScore: string; feedbackSuggestion: string; } | null> => {
        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'analyzeLogEntry', payload: { logContent } })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI analysis failed');
            }
            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error("Error analyzing log entry with AI:", error);
            return null;
        }
    },

    generateLogEntry: async (week: number, title: string, notes: string): Promise<string> => {
        try {
             const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'generateLogEntry', payload: { week, title, notes } })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI generation failed');
            }
            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error("Error generating log entry:", error);
            return "There was an error generating the log entry content. Please try again or write it manually.";
        }
    },

    generateFinalSummary: async (logContents: string): Promise<string> => {
        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'generateFinalSummary', payload: { logContents } })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI summary generation failed');
            }
            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error("Error generating final summary:", error);
            return "There was an error generating the summary. Please try again or write it manually.";
        }
    },
    
    identifyAndSaveSkillsForLog: async (log: LogEntry): Promise<void> => {
        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'identifySkills', payload: { logContent: log.content } })
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'AI skill identification failed');
            }
            const { result: extractedSkills } = await response.json() as { result: { technical: string[], soft: string[] }};
            if (!extractedSkills) return;
            
            const existingSkills = await api.getSkillsForStudent(log.studentId);
            const updates: { [key: string]: any } = {};

            const processSkills = (skillNames: string[], category: 'technical' | 'soft') => {
                skillNames.forEach(skillName => {
                    const skillNameClean = skillName.trim();
                    if (!skillNameClean) return;

                    const existingSkill = existingSkills.find(s => s.name.toLowerCase() === skillNameClean.toLowerCase() && s.category === category);
                    
                    if (existingSkill) {
                        // Skill exists, update it if the log ID isn't already there
                        if (!existingSkill.logIds.includes(log.id)) {
                            const updatedLogIds = [...existingSkill.logIds, log.id];
                            updates[`/skills/${existingSkill.id}/logIds`] = updatedLogIds;
                        }
                    } else {
                        // Skill is new, create it
                        const newSkillRef = push(ref(db, 'skills'));
                        updates[`/skills/${newSkillRef.key}`] = {
                            studentId: log.studentId,
                            name: skillNameClean,
                            category: category,
                            logIds: [log.id]
                        };
                    }
                });
            };

            processSkills(extractedSkills.technical || [], 'technical');
            processSkills(extractedSkills.soft || [], 'soft');

            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
            }

        } catch (error) {
            console.error("Error identifying and saving skills:", error);
        }
    },

    // --- User Management ---
    getUserById: async (id: string): Promise<User | null> => {
        const snapshot = await get(ref(db, `users/${id}`));
        return snapshotToObj<User>(snapshot);
    },

    getAllUsers: async (): Promise<User[]> => {
        const snapshot = await get(ref(db, 'users'));
        return snapshotToArr<User>(snapshot).reverse();
    },

    createUserProfile: async (userId: string, data: Omit<User, 'id'>): Promise<User> => {
        if (data.role === UserRole.Student) {
            (data as any).itStatus = ItStatus.Ongoing;
        }
        await set(ref(db, `users/${userId}`), data);
        return { id: userId, ...data };
    },
    
    bulkCreateUserProfiles: async (usersData: any[]): Promise<{successCount: number, errors: {data: any, error: string}[]}> => {
        let successCount = 0;
        const errors: {data: any, error: string}[] = [];
        const seenEmails = new Set();
        
        for (const userData of usersData) {
            const email = userData.email?.toLowerCase();
            try {
                if (!email || !userData.firstName || !userData.surname || !userData.role) {
                    throw new Error("Row is missing required fields (firstName, surname, email, role).");
                }
                if (seenEmails.has(email)) {
                    throw new Error(`Duplicate email in CSV file: ${email}`);
                }
                seenEmails.add(email);

                // 1. Create auth user with a temporary random password
                const tempPassword = Math.random().toString(36).slice(-10) + "Aa1!";
                const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
                const newUserId = userCredential.user.uid;

                // 2. Build the database profile
                const profile: Omit<User, 'id'> = {
                    firstName: userData.firstName,
                    surname: userData.surname,
                    email: email,
                    role: userData.role,
                };

                if (profile.role === UserRole.Student) {
                    profile.itStatus = ItStatus.Ongoing;
                    profile.gender = userData.gender || '';
                    profile.school = userData.school || '';
                    profile.faculty = userData.faculty || '';
                    profile.department = userData.department || '';
                    profile.level = Number(userData.level) || 100;
                } else if (profile.role === UserRole.Supervisor) {
                    profile.supervisorCode = userData.supervisorCode || `SUPER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                    profile.companyName = userData.companyName || '';
                    profile.companyRole = userData.companyRole || '';
                } else if (profile.role !== UserRole.Admin) { // Don't allow creating admins via bulk import for security
                     throw new Error(`Invalid role: '${profile.role}'. Must be 'student' or 'supervisor'.`);
                }
                
                // 3. Save profile to database with the correct Firebase Auth UID
                await set(ref(db, `users/${newUserId}`), profile);

                // 4. Send password reset email so user can set their own password
                await sendPasswordResetEmail(auth, email);
                
                successCount++;

            } catch (error: any) {
                let errorMessage = error.message;
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = `An account for ${email} already exists.`;
                }
                errors.push({ data: userData, error: errorMessage });
            }
        }
        return { successCount, errors };
    },

    recordUserLogin: async (userId: string): Promise<void> => {
        const updates = {
            lastLogin: new Date().toISOString()
        };
        await update(ref(db, `users/${userId}`), updates);
    },
    
    findSupervisorByCode: async (code: string): Promise<User | null> => {
        const q = query(ref(db, 'users'), orderByChild('supervisorCode'), equalTo(code));
        const snapshot = await get(q);
        const users = snapshotToArr<User>(snapshot);
        return users.length > 0 ? users[0] : null;
    },
    
    linkStudentToSupervisor: async (studentId: string, supervisorCode: string): Promise<{ success: boolean; message: string; user?: User | null }> => {
        const supervisor = await api.findSupervisorByCode(supervisorCode);
        if (!supervisor) {
            return { success: false, message: "Invalid supervisor code. Please check and try again." };
        }

        try {
            // Update student's profile with supervisorId. This is the only write needed for the link.
            await update(ref(db, `users/${studentId}`), { supervisorId: supervisor.id });
            
            // Create a notification for the supervisor
            const student = await api.getUserById(studentId);
            if (student) {
                 const notification = {
                    userId: supervisor.id,
                    message: `${student.firstName} ${student.surname} has added you as their supervisor.`,
                    read: false,
                    createdAt: new Date().toISOString(),
                };
                await push(ref(db, 'notifications'), notification);
            }

            const updatedUser = await api.getUserById(studentId);
            return { success: true, message: "Supervisor linked successfully!", user: updatedUser };
        } catch (error) {
            console.error("Error linking supervisor:", error);
            return { success: false, message: "An error occurred while linking the supervisor." };
        }
    },

    getSupervisorDashboardData: async (supervisorId: string): Promise<{ students: User[], logs: LogEntry[] }> => {
        try {
            const response = await fetch('/.netlify/functions/getSupervisorDashboardData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supervisorId })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch supervisor data');
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching supervisor dashboard data:", error);
            return { students: [], logs: [] };
        }
    },
    
    getSkillsForStudent: async (studentId: string): Promise<Skill[]> => {
        const q = query(ref(db, 'skills'), orderByChild('studentId'), equalTo(studentId));
        const snapshot = await get(q);
        return snapshotToArr<Skill>(snapshot);
    },

    updateUserProfilePicture: async (userId: string, avatarUrl: string): Promise<User | null> => {
        await update(ref(db, `users/${userId}`), { avatarUrl });
        return api.getUserById(userId);
    },

    deleteUserAndData: async (userId: string): Promise<boolean> => {
        try {
            const userToDelete = await api.getUserById(userId);
            if (!userToDelete) return false;

            const updates: { [key: string]: any } = {};

            updates[`/users/${userId}`] = null;

            if (userToDelete.role === UserRole.Student) {
                const logs = await api.getLogsForStudent(userId);
                logs.forEach(log => {
                    updates[`/logs/${log.id}`] = null;
                });
            } else if (userToDelete.role === UserRole.Supervisor) {
                const studentsQuery = query(ref(db, 'users'), orderByChild('supervisorId'), equalTo(userId));
                const studentsSnapshot = await get(studentsQuery);
                if (studentsSnapshot.exists()) {
                    studentsSnapshot.forEach(studentSnap => {
                         updates[`/users/${studentSnap.key}/supervisorId`] = null;
                    });
                }
            }

            const notifications = await api.getNotifications(userId);
            notifications.forEach(n => {
                updates[`/notifications/${n.id}`] = null;
            });
            
            await update(ref(db), updates);

            return true;
        } catch (error) {
            console.error("Error deleting user and data:", error);
            return false;
        }
    },

    // --- Admin Features ---
    logEvent: async (type: SystemEvent['type'], message: string): Promise<void> => {
        const eventData = { type, message, timestamp: new Date().toISOString() };
        await push(ref(db, 'systemEvents'), eventData);
    },

    getSystemEvents: async (limit: number = 50): Promise<SystemEvent[]> => {
        const q = query(ref(db, 'systemEvents'), orderByChild('timestamp'));
        const snapshot = await get(q);
        const events = snapshotToArr<SystemEvent>(snapshot);
        return events.reverse().slice(0, limit);
    },

    getBrandingSettings: async (): Promise<BrandingSettings | null> => {
        const snapshot = await get(ref(db, 'branding/settings'));
        return snapshot.exists() ? snapshot.val() : null;
    },

    updateBrandingSettings: async (settings: BrandingSettings): Promise<void> => {
        await set(ref(db, 'branding/settings'), settings);
    },

    getAnnouncements: async (): Promise<Announcement[]> => {
        const snapshot = await get(ref(db, 'announcements'));
        return snapshotToArr<Announcement>(snapshot).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    createAnnouncement: async (title: string, content: string): Promise<void> => {
        const announcementData = { title, content, createdAt: new Date().toISOString(), active: true };
        await push(ref(db, 'announcements'), announcementData);
    },

    toggleAnnouncementStatus: async (announcementId: string, currentStatus: boolean): Promise<void> => {
        await update(ref(db, `announcements/${announcementId}`), { active: !currentStatus });
    },

    deleteAnnouncement: async (announcementId: string): Promise<void> => {
        await remove(ref(db, `announcements/${announcementId}`));
    },

    getProgramCycles: async (): Promise<ProgramCycle[]> => {
        const snapshot = await get(ref(db, 'programCycles'));
        return snapshotToArr<ProgramCycle>(snapshot).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    },

    createProgramCycle: async (name: string, startDate: string, endDate: string): Promise<void> => {
        const cycleData = { name, startDate, endDate };
        await push(ref(db, 'programCycles'), cycleData);
    },

    deleteProgramCycle: async (cycleId: string): Promise<void> => {
        await remove(ref(db, `programCycles/${cycleId}`));
    },


    // --- Log Management ---
    getLogsForStudent: async (studentId: string): Promise<LogEntry[]> => {
        const q = query(ref(db, 'logs'), orderByChild('studentId'), equalTo(studentId));
        const snapshot = await get(q);
        const logs = snapshotToArr<LogEntry>(snapshot);
        return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    createLog: async (logData: Omit<LogEntry, 'id' | 'status' | 'feedback'>): Promise<LogEntry> => {
        const newLogRef = push(ref(db, 'logs'));
        const newLog: Omit<LogEntry, 'id'> = {
            ...logData,
            status: LogStatus.Pending,
        };
        await set(newLogRef, newLog);
        const logId = newLogRef.key!;
        
        const student = await api.getUserById(logData.studentId);
        if (student) {
            await api.logEvent('log_submitted', `${student.firstName} ${student.surname} submitted a log for week ${newLog.week}.`);
            if (student.supervisorId) {
                const notification = {
                    userId: student.supervisorId,
                    message: `${student.firstName} ${student.surname} submitted a log for week ${newLog.week}.`,
                    read: false,
                    createdAt: new Date().toISOString(),
                    logId: logId,
                };
                await push(ref(db, 'notifications'), notification);
            }
        }
        return { id: logId, ...newLog };
    },

    updateLog: async (logId: string, updates: Partial<LogEntry>): Promise<LogEntry | null> => {
        const logRef = ref(db, `logs/${logId}`);
        const snapshot = await get(logRef);
        const originalLog = snapshotToObj<LogEntry>(snapshot);

        if (!originalLog) return null;
        
        const updatePayload: Partial<LogEntry> & {feedback?: any} = { ...updates };
        if (originalLog.status === LogStatus.Rejected) {
            updatePayload.status = LogStatus.Pending;
            updatePayload.feedback = null;

            const student = await api.getUserById(originalLog.studentId);
             if (student?.supervisorId) {
                // Remove old notification for this log
                await api.removeNotificationForLog(logId, student.supervisorId);
                const notification = {
                    userId: student.supervisorId,
                    message: `${student.firstName} ${student.surname} has updated their rejected log for week ${originalLog.week}.`,
                    read: false,
                    createdAt: new Date().toISOString(),
                    logId: logId,
                };
                await push(ref(db, 'notifications'), notification);
            }
        }

        await update(logRef, updatePayload);
        return api.getLogById(logId);
    },

    deleteLog: async (logId: string): Promise<boolean> => {
        await remove(ref(db, `logs/${logId}`));
        await api.removeNotificationForLog(logId, null);
        return true;
    },

    getLogById: async (logId: string): Promise<LogEntry | null> => {
        const snapshot = await get(ref(db, `logs/${logId}`));
        return snapshotToObj<LogEntry>(snapshot);
    },

    updateLogStatus: async (logId: string, status: LogStatus, feedback?: string): Promise<LogEntry | null> => {
        const updates: Partial<LogEntry> & {feedback?: any} = { status, feedback: feedback || null };
        await update(ref(db, `logs/${logId}`), updates);

        const log = await api.getLogById(logId);
        if (log) {
            const statusText = status === LogStatus.Approved ? 'approved' : 'rejected';
            const studentNotification = {
                userId: log.studentId,
                message: `Your log for week ${log.week} has been ${statusText}.`,
                read: false,
                createdAt: new Date().toISOString(),
                logId: logId,
            };
            await push(ref(db, 'notifications'), studentNotification);

            const student = await api.getUserById(log.studentId);
            if (student) {
                if (status === LogStatus.Approved) {
                    await api.logEvent('log_approved', `Log for week ${log.week} for ${student.firstName} ${student.surname} was approved.`);
                    api.identifyAndSaveSkillsForLog(log); // Fire-and-forget skill identification
                }
                if (student.supervisorId) {
                    await api.removeNotificationForLog(logId, student.supervisorId);
                }
            }
        }
        return log;
    },

    addCommentToLog: async (logId: string, comment: string): Promise<LogEntry | null> => {
        const updates = { feedback: comment || null };
        await update(ref(db, `logs/${logId}`), updates);

        const log = await api.getLogById(logId);
        if (log) {
            // Avoid sending notification if comment is empty/cleared
            if (comment.trim()) {
                const studentNotification = {
                    userId: log.studentId,
                    message: `Your supervisor commented on your log for week ${log.week}.`,
                    read: false,
                    createdAt: new Date().toISOString(),
                    logId: logId,
                };
                await push(ref(db, 'notifications'), studentNotification);
            }
        }
        return log;
    },

    // --- IT Completion Workflow ---
    requestFinalReview: async (studentId: string, finalSummary: string): Promise<User | null> => {
        const student = await api.getUserById(studentId);
        if (!student) return null;

        const updates = {
            itStatus: ItStatus.AwaitingApproval,
            finalSummary: finalSummary,
        };
        await update(ref(db, `users/${studentId}`), updates);

        if (student.supervisorId) {
            const notification = {
                userId: student.supervisorId,
                message: `${student.firstName} ${student.surname} has submitted their logbook for final review.`,
                read: false,
                createdAt: new Date().toISOString(),
                studentId: studentId,
                type: 'final_review_request',
            };
            await push(ref(db, 'notifications'), notification);
        }
        await api.logEvent('logbook_finalized', `${student.firstName} ${student.surname} submitted their logbook for final review.`);
        
        return api.getUserById(studentId);
    },

    cancelFinalReview: async (studentId: string): Promise<User | null> => {
        const updates = { itStatus: ItStatus.Ongoing };
        await update(ref(db, `users/${studentId}`), updates);
        // We could also notify the supervisor here if desired
        return api.getUserById(studentId);
    },

    handleFinalSignOff: async (studentId: string, evaluation: string, action: 'approve' | 'request_changes'): Promise<User | null> => {
        const student = await api.getUserById(studentId);
        if (!student) return null;
        
        const updates: { [key: string]: any } = { supervisorEvaluation: evaluation };
        let notificationMessage = '';
        
        if (action === 'approve') {
            updates.itStatus = ItStatus.Completed;
            notificationMessage = `Congratulations! Your supervisor has approved your final logbook submission.`;
        } else { // request_changes
            updates.itStatus = ItStatus.Ongoing;
            notificationMessage = `Your supervisor has requested changes to your logbook. Please review their evaluation and your logs.`;
        }
        
        await update(ref(db, `users/${studentId}`), updates);

        const notification = {
            userId: studentId,
            message: notificationMessage,
            read: false,
            createdAt: new Date().toISOString(),
        };
        await push(ref(db, 'notifications'), notification);

        return api.getUserById(studentId);
    },

    // --- Notifications ---
    getNotifications: async (userId: string): Promise<Notification[]> => {
        const q = query(ref(db, 'notifications'), orderByChild('userId'), equalTo(userId));
        const snapshot = await get(q);
        const notifs = snapshotToArr<Notification>(snapshot);
        return notifs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    markNotificationAsRead: async (notificationId: string): Promise<void> => {
        await update(ref(db, `notifications/${notificationId}`), { read: true });
    },

    markAllNotificationsAsRead: async (userId: string): Promise<void> => {
        const notifications = await api.getNotifications(userId);
        const updates: { [key: string]: any } = {};
        notifications.forEach(n => {
            if (!n.read) {
                updates[`/notifications/${n.id}/read`] = true;
            }
        });
        if(Object.keys(updates).length > 0) {
            await update(ref(db), updates);
        }
    },
    
    clearReadNotifications: async (userId: string): Promise<void> => {
        const notifications = await api.getNotifications(userId);
        const updates: { [key: string]: any } = {};
        notifications.forEach(n => {
            if (n.read) {
                updates[`/notifications/${n.id}`] = null;
            }
        });
        if(Object.keys(updates).length > 0) {
            await update(ref(db), updates);
        }
    },

    removeNotificationForLog: async (logId: string, userId: string | null) => {
        const q = query(ref(db, 'notifications'), orderByChild('logId'), equalTo(logId));
        const snapshot = await get(q);
        if(snapshot.exists()) {
            const updates: { [key: string]: any } = {};
            snapshot.forEach((child: any) => {
                // If a userId is specified, only remove notifications for that user.
                // Otherwise, remove all notifications for that logId.
                if (!userId || child.val().userId === userId) {
                     updates[`/notifications/${child.key}`] = null;
                }
            });
             if(Object.keys(updates).length > 0) {
                await update(ref(db), updates);
            }
        }
    },
};