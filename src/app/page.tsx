"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      router.push('/terminal');
    }
  }, [user, router]);

  const handleAuth = async (authFn: typeof signInWithEmailAndPassword | typeof createUserWithEmailAndPassword, form: HTMLFormElement) => {
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Email and password are required.',
      });
      return;
    }

    try {
      await authFn(auth, email, password);
      toast({
        title: 'Success',
        description: authFn === signInWithEmailAndPassword ? 'Logged in successfully!' : 'Account created and logged in!',
      });
      router.push('/terminal');
    } catch (error: any) {
      const authError = error;
      let errorMessage = authError.message;
      if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (authError.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Please try logging in.';
      }
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: errorMessage,
      });
    }
  };
  
  const onFormSubmit = (authFn: typeof signInWithEmailAndPassword | typeof createUserWithEmailAndPassword) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleAuth(authFn, event.currentTarget);
  };
  
  if (loading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <main className="flex h-screen w-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-shadow-glow">Login</CardTitle>
          <CardDescription>Enter your credentials to access the terminal. New users will be automatically registered.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" placeholder="m@example.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={(e) => { e.preventDefault(); handleAuth(signInWithEmailAndPassword, e.currentTarget.form!);}} type="submit" className="w-full">Sign In</Button>
              <Button onClick={(e) => { e.preventDefault(); handleAuth(createUserWithEmailAndPassword, e.currentTarget.form!);}} type="submit" className="w-full" variant="outline">Sign Up</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
