
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { setupAccount } from '@/lib/actions';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username cannot be longer than 20 characters.')
    .regex(/^[a-z0-9_.]+$/, 'Username can only contain lowercase letters, numbers, underscores, and periods.'),
  password: z.string().min(8, 'New password must be at least 8 characters.'),
});

type SetupFormValues = z.infer<typeof formSchema>;

export default function SetupAccountPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: SetupFormValues) => {
    setIsLoading(true);
    try {
      const result = await setupAccount({ ...values, token: params.token });
      if (result.success) {
        toast({
          title: 'Account Setup Complete!',
          description: 'You can now log in with your new credentials.',
        });
        router.push('/read');
        router.refresh();
      } else {
        throw new Error(result.message || 'Failed to set up account.');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle>Set Up Your Readify Account</CardTitle>
          <CardDescription>
            Choose a unique username and a secure password to complete your registration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="your.username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Setup
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
