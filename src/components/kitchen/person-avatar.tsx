"use client";

import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePerson } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";
import { Avatar as AvatuneAvatar } from "@avatune/react";
import theme from "@avatune/pacovqzz-theme/react";

/**
 * Avatar for a person id. Renders `avatarUrl` when set (from onboarding);
 * falls back to an Avatune generated avatar otherwise.
 *
 * A client component reading the directory from context rather than a server
 * component awaiting `getPerson`, because it renders on both sides of the
 * boundary: page headers and tables on the server, message lists and the share
 * dialog on the client. Context is the only form that works from both.
 */
export function PersonAvatar({
  personId,
  className,
}: {
  personId: string;
  className?: string;
}) {
  const person = usePerson(personId);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!person) return null;

  return (
    <Avatar className={cn("size-6", className)}>
      {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
      <AvatarFallback
        className="flex size-full items-center justify-center overflow-hidden [&>svg]:size-full"
        style={{ backgroundColor: person.color }}
      >
        {isMounted && <AvatuneAvatar theme={theme} size={120} seed={person.id} />}
      </AvatarFallback>
    </Avatar>
  );
}

/** Overlapping participant stack shown in conversation and folder headers. */
export function AvatarStack({
  personIds,
  className,
}: {
  personIds: string[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {personIds.map((id) => (
        <PersonAvatar
          key={id}
          personId={id}
          className="size-6 ring-2 ring-background"
        />
      ))}
    </div>
  );
}
