"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import Terminal from '@/components/terminal';

export default function TerminalPage() {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center text-primary">Loading...</div>;
  }
  
  if (error) {
    return <div className="flex h-screen w-full items-center justify-center text-destructive">Error: {error.message}</div>;
  }

  return (
    <main>
      <Terminal user={user} />
    </main>
  );
}
