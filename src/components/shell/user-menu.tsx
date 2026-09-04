"use client";

/**
 * The avatar in the top-right, and the only route out of a session.
 *
 * Sign-out has to clear both halves of the session — the client SDK's own
 * state and the server's cookie — so it goes through `signOut()` in
 * auth-actions rather than calling either one directly.
 */
import { useState } from "react";
import { useTheme } from "next-themes";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { useCurrentUser } from "@/components/workspace-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/firebase/auth-actions";
import { requestNotificationPermission } from "@/lib/firebase/messaging";
import { registerDeviceTokenAction } from "@/app/(workspace)/actions";

export function UserMenu() {
  const currentUser = useCurrentUser();
  const [pending, setPending] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!currentUser) return null;

  const onSignOut = async () => {
    setPending(true);
    try {
      await signOut();
      // Hard navigation, mirroring sign-in: the cookie was cleared by a fetch
      // the router doesn't know about, so its cache still holds signed-in
      // renders of every workspace route. A client-side push would show them.
      window.location.replace("/sign-in");
      return;
    } catch {
      // Leaving the menu in a pending state would strand the user with no way
      // out; let them try again instead.
      setPending(false);
    }
  };

  const [requestingNotification, setRequestingNotification] = useState(false);
  const onEnableNotifications = async (e: React.MouseEvent) => {
    e.preventDefault();
    setRequestingNotification(true);
    try {
      const token = await requestNotificationPermission();
      if (token) {
        await registerDeviceTokenAction(token);
        alert("Notifications enabled successfully!");
      } else {
        alert("Could not enable notifications. Please check your browser permissions or Firebase config.");
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred.");
    } finally {
      setRequestingNotification(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-k-blue"
      >
        <PersonAvatar personId={currentUser.id} className="size-7" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate font-medium text-k-black-84">
              {currentUser.name}
            </span>
            <span className="truncate font-normal text-k-black-40 text-xs">
              {currentUser.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem disabled={requestingNotification} onClick={onEnableNotifications}>
            {requestingNotification ? "Enabling..." : "Enable Notifications"}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal text-k-black-40 text-xs">
            Appearance
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={pending} onClick={onSignOut}>
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
