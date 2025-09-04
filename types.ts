

export enum UserRole {
  Student = 'student',
  Supervisor = 'supervisor',
  Admin = 'admin',
}

export enum LogStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum ItStatus {
  Ongoing = 'ongoing',
  AwaitingApproval = 'awaiting_approval',
  Completed = 'completed',
}

export interface User {
  id: string;
  firstName: string;
  surname: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  // Student specific
  supervisorId?: string; 
  gender?: string;
  school?: string;
  faculty?: string;
  department?: string;
  level?: number;
  itStatus?: ItStatus;
  finalSummary?: string;
  supervisorEvaluation?: string;
  lastLogin?: string;
  // Supervisor specific
  supervisorCode?: string;
  companyName?: string;
  companyRole?: string;
}

export interface LogEntry {
  id: string;
  studentId: string;
  date: string;
  week: number;
  title: string;
  content: string;
  attachments: { name: string; url: string }[];
  status: LogStatus;
  feedback?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
  logId?: string;
  studentId?: string;
  type?: string;
}
// FIX: Added Skill interface to define the shape of skill data.
export interface Skill {
  id: string;
  studentId: string;
  name: string;
  category: 'technical' | 'soft';
  logIds: string[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  active: boolean;
}

export interface ProgramCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SystemEvent {
  id: string;
  type: 'user_registered' | 'log_submitted' | 'logbook_finalized' | 'log_approved';
  message: string;
  timestamp: string;
}

export interface BrandingSettings {
  logoUrl?: string; // base64 string
  theme?: 'default' | 'teal' | 'rose' | 'indigo' | 'emerald' | 'amber';
}