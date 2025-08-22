"use client";

import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import Terminal from '@/components/terminal';
import CyberLogo from '@/components/cyber-logo';

export default function TerminalPage() {
  // Handle case where Firebase is not configured.
  if (!auth) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 font-code text-destructive">
        <div className="max-w-lg rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center">
          <h2 className="text-xl font-bold">Firebase Not Configured</h2>
          <p className="mt-2">
            Firebase configuration is missing or incomplete. Please copy the `/.env.example` file to `/.env` and fill in your Firebase project details.
          </p>
          <p className="mt-4 text-xs text-destructive/80">
            The application will not function correctly until Firebase is set up.
          </p>
        </div>
      </div>
    );
  }

  const [user, loading, error] = useAuthState(auth);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 font-code text-primary">
        <CyberLogo />
        <p className="mt-4 text-lg animate-pulse">Connecting to the Grid...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 font-code text-destructive">
        <div className="max-w-md rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <h2 className="text-lg font-bold">Connection Error</h2>
          <p className="mt-2 text-sm">Could not connect to authentication service.</p>
          <p className="mt-1 text-xs text-destructive/80">Details: {error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-full bg-background">
      <Terminal user={user} />
    </main>
  );
}
