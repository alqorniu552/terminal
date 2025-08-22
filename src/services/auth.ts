
'use server';

import { getAuthInstance } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}


/**
 * Logs in a user with email and password.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A success message.
 * @throws An error with a user-friendly message if login fails.
 */
export async function loginUser(email: string, password?: string): Promise<string> {
  if (!password) {
    throw new AuthError('Password is required.');
  }
  const auth = getAuthInstance();
  if (!auth) {
    throw new AuthError('Authentication service is not available.');
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return 'Login successful.';
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new AuthError('Invalid email or password.');
    }
    throw new AuthError('An unexpected error occurred during login.');
  }
}

interface RegisterResult {
    success: boolean;
    message: string;
    username?: string;
}

/**
 * Registers a new user and creates their home directory.
 * @param email The new user's email.
 * @param password The new user's password.
 * @returns A result object with success status and message.
 * @throws An error with a user-friendly message if registration fails.
 */
export async function registerUser(email: string, password?: string): Promise<RegisterResult> {
    if (!password) {
        throw new AuthError('Password is required.');
    }
    const auth = getAuthInstance();
    if (!auth) {
        throw new AuthError('Authentication service is not available.');
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const username = userCredential.user.email?.split('@')[0];
        
        return {
            success: true,
            message: 'Registration successful. You are now logged in.',
            username,
        };

    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            throw new AuthError('An account with this email already exists.');
        } else if (error.code === 'auth/weak-password') {
            throw new AuthError('Password is too weak. It should be at least 6 characters.');
        }
        throw new AuthError('An unexpected error occurred during registration.');
    }
}


/**
 * Logs out the current user.
 * @returns A success message.
 * @throws An error if logout fails.
 */
export async function logoutUser(): Promise<string> {
    const auth = getAuthInstance();
    if (!auth) {
        throw new AuthError('Authentication service is not available.');
    }
    try {
        await signOut(auth);
        return 'Logged out successfully.';
    } catch (error) {
        console.error("Logout error: ", error);
        throw new AuthError('Failed to log out.');
    }
}
