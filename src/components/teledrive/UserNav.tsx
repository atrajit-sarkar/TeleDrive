
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, UserCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { checkAuthStatus, logoutUser } from "@/app/actions";
import type { User } from "@/lib/types";

export function UserNav() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const fetchUserStatus = async () => {
      setIsLoading(true);
      const authData = await checkAuthStatus();
      if (authData.loggedIn && authData.user) {
        setUser(authData.user);
      } else {
        setUser(null);
        // Optionally redirect if not logged in, though page.tsx might handle this
        // router.push("/login"); 
      }
      setIsLoading(false);
    };
    fetchUserStatus();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const response = await logoutUser();
    setIsLoggingOut(false);
    if (response.error) {
      toast({ title: "Logout Failed", description: response.error, variant: "destructive" });
    } else {
      toast({ title: "Logged Out", description: response.message });
      setUser(null);
      router.push("/login");
    }
  };

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  }

  const displayName = user?.firstName || user?.username || "User";
  const fallbackName = displayName.substring(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {/* For now, using placeholder as backend doesn't provide avatar URL */}
            <AvatarImage src={`https://placehold.co/40x40.png?text=${fallbackName}`} alt={displayName} data-ai-hint="profile avatar" />
            <AvatarFallback>{fallbackName}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        {user ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                {user.username && <p className="text-xs leading-none text-muted-foreground">@{user.username}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
              <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
            </DropdownMenuItem>
          </>
        ) : (
           <DropdownMenuItem onClick={() => router.push('/login')}>
              <LogOut className="mr-2 h-4 w-4 rotate-180" />
              <span>Log In</span>
            </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
