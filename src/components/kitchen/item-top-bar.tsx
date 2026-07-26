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
}: {
  breadcrumb: string;
  participants: string[];
  shareTitle: string;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-5">
      <span className="min-w-0 truncate text-k-black-56 text-md">
        {breadcrumb}
      </span>
      <div className="ml-auto flex items-center gap-3">
        <AvatarStack personIds={participants} />
        <ShareDialog title={shareTitle} />
      </div>
    </div>
  );
}
