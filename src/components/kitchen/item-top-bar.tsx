import { AvatarStack } from "@/components/kitchen/person-avatar";
import { ShareDialog } from "@/components/kitchen/share-dialog";

/**
 * The bar every item view carries: breadcrumb on the left, participants and
 * Share on the right.
 */
export function ItemTopBar({
  breadcrumb,
  participants,
  shareTitle,
  resourceId,
  resourceType,
  initialAccess,
  roles,
  authorId,
}: {
  breadcrumb: string;
  participants: string[];
  shareTitle: string;
  resourceId: string;
  resourceType: "conversation" | "folder" | "document" | "board" | "embed";
  initialAccess?: "invited" | "link";
  roles?: Record<string, "viewer" | "editor" | "full">;
  authorId?: string;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-5">
      <span className="min-w-0 truncate text-k-black-56 text-md">
        {breadcrumb}
      </span>
      <div className="ml-auto flex items-center gap-3">
        <AvatarStack personIds={participants} />
        {resourceType === "folder" && (
          <ShareDialog 
            title={shareTitle} 
            resourceId={resourceId} 
            resourceType={resourceType} 
            initialAccess={initialAccess} 
            roles={roles}
            authorId={authorId}
          />
        )}
      </div>
    </div>
  );
}
