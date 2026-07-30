"use client";

/**
 * The Favourite star, for every header that has one — folder, conversation,
 * board, document and embed.
 *
 * `Folder.starred` and `Conversation.starred` had been in the domain model
 * since the original scan with nothing writing them; the star was a button
 * that changed colour on hover and did nothing. Board, document and embed
 * gained the field so all five behave the same way.
 *
 * Optimistic, then reconciled against the server-rendered prop the same way
 * the board's colour picker is (handoff-2, trap 13): the star fills the
 * instant it's clicked, and a `revalidatePath` that brings a different value
 * back wins.
 */
import { useState, useTransition } from "react";
import { StarIcon } from "lucide-react";
import { setStarredAction } from "@/app/(workspace)/actions";
import type { StarrableKind } from "@/lib/kitchen-data";
import { cn } from "@/lib/utils";

export function StarButton({
  kind,
  id,
  starred,
  className,
}: {
  kind: StarrableKind;
  id: string;
  /** Optional in the model on the three kinds that gained it late. */
  starred: boolean | undefined;
  className?: string;
}) {
  const [on, setOn] = useState(starred === true);
  const [serverValue, setServerValue] = useState(starred);
  const [pending, startTransition] = useTransition();

  if (starred !== serverValue) {
    setServerValue(starred);
    setOn(starred === true);
  }

  const toggle = () => {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await setStarredAction(kind, id, next);
      } catch {
        setOn(!next);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Remove from favourites" : "Add to favourites"}
      title={on ? "Remove from favourites" : "Add to favourites"}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-60",
        on
          ? "text-k-yellow hover:bg-k-yellow-08"
          : "text-k-black-36 hover:bg-k-black-04 hover:text-k-black-84",
        className,
      )}
    >
      <StarIcon
        className="size-4"
        strokeWidth={1.6}
        fill={on ? "currentColor" : "none"}
      />
    </button>
  );
}
