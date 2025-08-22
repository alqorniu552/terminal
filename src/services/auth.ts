'use server';

import { getAuthInstance } from '@/lib/firebase';
import { addNodeToFilesystem } from '@/lib/filesystem';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

/**
 * Logs in a user with email and password.
 * @param email The user's email.
 * @param password The user's password.
 * @returns A success message.
 * @throws An error with a user-friendly message if login fails.
 */
export async function loginUser(email: string, password?: string): Promise<string> {
  if (!password) {
    throw new Error('Password is required.');
  }
  const auth = getAuthInstance();
  if (!auth) {
    throw new Error('Authentication service is not available.');
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return 'Login successful.';
  } catch (error: any) {
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      throw new Error('Invalid email or password.');
    }
    throw new Error('An unexpected error occurred during login.');
  }
}

/**
 * Registers a new user and creates their home directory.
 * @param email The new user's email.
 * @param password The new user's password.
 * @returns A success message.
 * @throws An error with a user-friendly message if registration fails.
 */
export async function registerUser(email: string, password?: string): Promise<string> {
    if (!password) {
        throw new Error('Password is required.');
    }
    const auth = getAuthInstance();
    if (!auth) {
        throw new Error('Authentication service is not available.');
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const username = userCredential.user.email?.split('@')[0];
        if (username) {
            // Create a home directory for the new user
            addNodeToFilesystem('/home', username, { type: 'directory', children: {} });
        }
        return 'Registration successful. You are now logged in.';
    } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('An account with this email already exists.');
        } else if (error.code === 'auth/weak-password') {
            throw new Error('Password is too weak. It should be at least 6 characters.');
        }
        throw new Error('An unexpected error occurred during registration.');
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
        throw new Error('Authentication service is not available.');
    }
    try {
        await signOut(auth);
        return 'Logged out successfully.';
    } catch (error) {
        console.error("Logout error: ", error);
        throw new Error('Failed to log out.');
    }
}
