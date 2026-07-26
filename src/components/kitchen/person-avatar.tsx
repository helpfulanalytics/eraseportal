import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getPerson } from "@/lib/kitchen-data";
import { cn } from "@/lib/utils";

/**
 * Avatar for a person id. Falls back to tinted initials — the mock dataset has
 * no image URLs, and initials read better than a generic silhouette.
 */
export function PersonAvatar({
  personId,
  className,
}: {
  personId: string;
  className?: string;
}) {
  const person = getPerson(personId);
  if (!person) return null;

  return (
    <Avatar className={cn("size-6", className)}>
      <AvatarFallback
        className="text-[9px] text-k-white"
        style={{ backgroundColor: person.color }}
      >
        {person.initials}
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
