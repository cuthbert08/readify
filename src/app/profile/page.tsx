'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { changeUserPassword } from '@/lib/user-actions';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

const formSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});

type PasswordFormValues = z.infer<typeof formSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    setIsLoading(true);
    try {
      const result = await changeUserPassword(values);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Your password has been changed successfully.',
        });
        form.reset();
      } else {
        throw new Error(result.message || 'Failed to change password.');
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
        <Button 
            variant="ghost" 
            className="absolute top-4 left-4"
            onClick={() => router.back()}
        >
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Enter your current password and a new password below.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                        <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>New Password</FormLabel>
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
                        Update Password
                    </Button>
                </div>
            </form>
            </Form>
        </CardContent>
      </Card>
    </main>
  );
}
