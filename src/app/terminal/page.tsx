"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import Terminal from '@/components/terminal';
import { Button } from '@/components/ui/button';

export default function TerminalPage() {
  const [user, loading, error] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center text-primary">Loading...</div>;
  }
  
  if (error) {
    return <div className="flex h-screen w-full items-center justify-center text-destructive">Error: {error.message}</div>;
  }

  if (user) {
    return (
      <main>
        <div className="absolute top-2 right-2 z-10">
          <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
        <Terminal />
      </main>
    );
  }

  return null;
}
