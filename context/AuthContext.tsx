

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
// FIX: Corrected import path for Firebase auth to use scoped package, resolving module export errors.
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser, sendEmailVerification } from '@firebase/auth';
import { User, UserRole } from '../types';
import { auth, api } from '../services/firebase';


interface RegisterPayload {
  firstName: string;
  surname: string;
  email: string;
  password: string;
  role: UserRole;
  avatarUrl?: string | null;
  // Student
  supervisorCode?: string;
  gender?: string;
  school?: string;
  faculty?: string;
  department?: string;
  level?: number;
  // Supervisor
  companyName?: string;
  companyRole?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password:string) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<string | null>;
  updateUser: (updatedUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            const userProfile = await api.getUserById(firebaseUser.uid);
            setUser(userProfile);
        } else {
            setUser(null);
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    // Ensure user has verified their email before allowing login
    if (!firebaseUser.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email address before logging in. Check your inbox (and spam folder) for the verification link sent during registration.");
    }
    await api.recordUserLogin(firebaseUser.uid);
    // Explicitly fetch user profile and set state to ensure isAuthenticated is true before navigating.
    const userProfile = await api.getUserById(firebaseUser.uid);
    setUser(userProfile);
  };
  
  const register = async (payload: RegisterPayload): Promise<string | null> => {
    try {
        let firebaseUser: FirebaseUser;
        let isReRegister = false;

        try {
            // 1. Attempt to create a new user
            const userCredential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
            firebaseUser = userCredential.user;
            // Send verification email for new users
            await sendEmailVerification(firebaseUser);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                // 2. If it fails, try signing in to see if it's a "deleted" user
                const signInCredential = await signInWithEmailAndPassword(auth, payload.email, payload.password);
                firebaseUser = signInCredential.user;
                
                const existingProfile = await api.getUserById(firebaseUser.uid);
                if (existingProfile) {
                    throw new Error("This email is already associated with an active account.");
                }
                isReRegister = true; // Mark that we are re-registering
            } else {
                throw error; // Re-throw other creation errors
            }
        }
        
        // 3. Now that we have a firebaseUser, build the profile data
        const userData: Omit<User, 'id'> = {
            firstName: payload.firstName,
            surname: payload.surname,
            email: firebaseUser.email!,
            role: payload.role,
        };

        if (payload.avatarUrl) {
            userData.avatarUrl = payload.avatarUrl;
        }

        if (payload.role === UserRole.Student) {
            if (payload.supervisorCode) { // Only process supervisor code if provided
                const supervisor = await api.findSupervisorByCode(payload.supervisorCode);
                if (!supervisor) {
                    // If an invalid code is provided, stop the registration.
                    if (!isReRegister) {
                        await deleteUser(firebaseUser); 
                    }
                    return "Invalid supervisor code provided. You can leave this field blank and add it later.";
                }
                userData.supervisorId = supervisor.id;
            }
            userData.gender = payload.gender;
            userData.school = payload.school;
            userData.faculty = payload.faculty;
            userData.department = payload.department;
            userData.level = payload.level;
        } else if (payload.role === UserRole.Supervisor) {
            userData.supervisorCode = `SUPER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            userData.companyName = payload.companyName;
            userData.companyRole = payload.companyRole;
        }
        
        // 5. Create the DB profile
        const newUserProfile = await api.createUserProfile(firebaseUser.uid, userData);
        
        // Log system event for new registration
        await api.logEvent('user_registered', `New user registered: ${payload.firstName} ${payload.surname} (${payload.role}).`);
        
        // Don't auto-login user after registration, they need to verify
        if (!isReRegister) {
            await signOut(auth);
        } else {
            setUser(newUserProfile);
        }
        
        return null; // Success

    } catch(error: any) {
         if (error.code === 'auth/wrong-password') {
             return "This email is already registered, but the password provided was incorrect.";
         }
         return error.message || "Registration failed.";
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, register, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};