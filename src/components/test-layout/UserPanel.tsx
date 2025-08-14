
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Settings, LogOut } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';

type UserPanelProps = {
    isAdmin: boolean;
    userEmail: string;
    onLogout: () => void;
    onNavigateToAdmin: () => void;
    onNavigateToProfile: () => void;
};

const UserPanel: React.FC<UserPanelProps> = ({
    isAdmin,
    userEmail,
    onLogout,
    onNavigateToAdmin,
    onNavigateToProfile
}) => {
    return (
        <>
            {isAdmin && (
                <>
                    <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={onNavigateToAdmin}>
                            <Settings />
                            Back to Admin
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    </SidebarMenu>
                    <Separator />
                </>
            )}
            <div className="flex items-center gap-3 p-2">
                <Avatar>
                <AvatarImage data-ai-hint="user avatar" src="https://placehold.co/40x40.png" />
                <AvatarFallback>{userEmail.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate" onClick={onNavigateToProfile} style={{cursor: 'pointer'}}>{userEmail}</p>
                </div>
                <Button onClick={onLogout} variant="ghost" size="icon">
                    <LogOut className="h-5 w-5"/>
                    <span className="sr-only">Log out</span>
                </Button>
            </div>
        </>
    );
};

export default UserPanel;
