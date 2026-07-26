"use client";

/**
 * The avatar in the top-right, and the only route out of a session.
 *
 * Sign-out has to clear both halves of the session — the client SDK's own
 * state and the server's cookie — so it goes through `signOut()` in
 * auth-actions rather than calling either one directly. `router.refresh()`
 * afterwards makes the workspace layout re-evaluate and redirect.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { useCurrentUser } from "@/components/workspace-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/firebase/auth-actions";

export function UserMenu() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [pending, setPending] = useState(false);

  if (!currentUser) return null;

  const onSignOut = async () => {
    setPending(true);
    try {
      await signOut();
      router.refresh();
      router.push("/sign-in");
    } catch {
      // Leaving the menu in a pending state would strand the user with no way
      // out; let them try again instead.
      setPending(false);
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
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium text-k-black-84">
            {currentUser.name}
          </span>
          <span className="truncate font-normal text-k-black-40 text-xs">
            {currentUser.email}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled={pending} onClick={onSignOut}>
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
