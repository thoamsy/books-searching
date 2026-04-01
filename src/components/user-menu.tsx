import { useState } from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginDialog } from "@/components/login-dialog";

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  if (loading) return null;

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setLoginOpen(true)}>
          <User data-icon="inline-start" />
          登录
        </Button>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "User";
  const initials = displayName
    .replace(/[\[\]（）()【】\s]/g, "")
    .charAt(0)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="size-8 overflow-hidden rounded-full ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:opacity-80"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="size-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-full bg-gradient-to-b from-primary/20 to-primary/40 text-xs font-medium text-primary">
              {initials}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium">{displayName}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={signOut}>
            <LogOut data-icon="inline-start" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
