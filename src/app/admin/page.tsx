
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Home, Users, FileText, Trash2, LogOut, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getAllUsers, getAllDocuments, deleteUser } from '@/lib/admin-actions';
import type { User, Document } from '@/lib/admin-actions';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import AddUserDialog from '@/components/add-user-dialog';


const chartConfig = {
  users: {
    label: "Users",
    color: "hsl(var(--chart-1))",
  },
  documents: {
    label: "Documents",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [usersData, documentsData] = await Promise.all([
        getAllUsers(),
        getAllDocuments(),
      ]);
      setUsers(usersData);
      setDocuments(documentsData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch admin data.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user and all their documents? This action cannot be undone.')) {
      try {
        const result = await deleteUser(userId);
        if (result.success) {
            toast({ title: 'Success', description: 'User deleted successfully.' });
            fetchAdminData(); // Refresh data
        } else {
            throw new Error(result.message);
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete user.',
        });
      }
    }
  };
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const totalUsers = users.length;
  const totalDocuments = documents.length;

  const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
  
  const signupData = last7Days.map(day => ({
      date: format(day, 'MMM d'),
      users: users.filter(u => format(parseISO(u.createdAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length
  }));

  const uploadData = last7Days.map(day => ({
      date: format(day, 'MMM d'),
      documents: documents.filter(d => format(parseISO(d.createdAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')).length
  }));


  return (
    <>
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-2xl font-headline text-primary flex items-center gap-2"><BarChart /> Readify Admin</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={() => router.push('/read')} variant="outline">Go to App</Button>
            <Button onClick={handleLogout} variant="ghost" size="icon">
                <LogOut className="h-5 w-5"/>
                <span className="sr-only">Log out</span>
            </Button>
          </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard"><Home className="mr-2"/>Dashboard</TabsTrigger>
            <TabsTrigger value="users"><Users className="mr-2"/>User Management</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="mr-2"/>Document Management</TabsTrigger>
          </TabsList>
          
          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalUsers}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalDocuments}</div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>New Users (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ChartContainer config={chartConfig}>
                            <RechartsBarChart data={signupData} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="users" fill="var(--color-users)" radius={4} />
                            </RechartsBarChart>
                        </ChartContainer>
                    </CardContent>
                 </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Documents Uploaded (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                       <ChartContainer config={chartConfig}>
                            <RechartsBarChart data={uploadData} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="documents" fill="var(--color-documents)" radius={4} />
                            </RechartsBarChart>
                        </ChartContainer>
                    </CardContent>
                 </Card>
            </div>
          </TabsContent>

          {/* User Management Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex justify-between items-center flex-row">
                <CardTitle>All Users</CardTitle>
                <Button onClick={() => setIsAddUserOpen(true)}><PlusCircle className="mr-2"/>Add User</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Signed Up</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.id}</TableCell>
                        <TableCell>{user.isAdmin ? 'Admin' : 'User'}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteUser(user.id)} disabled={user.isAdmin}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Document Management Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>All Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell>{doc.fileName}</TableCell>
                        <TableCell>{doc.userId}</TableCell>
                        <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                            <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline">View PDF</Button>
                            </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    <AddUserDialog 
      isOpen={isAddUserOpen}
      onClose={() => setIsAddUserOpen(false)}
      onUserAdded={() => {
        fetchAdminData();
        setIsAddUserOpen(false);
      }}
    />
    </>
  );
}
