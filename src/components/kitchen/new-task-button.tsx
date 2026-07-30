"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateTaskDialog } from "@/components/kitchen/create-task-dialog";

export function NewTaskButton({ folders }: { folders: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
      >
        <PlusIcon className="size-3.5" strokeWidth={1.8} />
        New task
      </button>
      {open ? <CreateTaskDialog folders={folders} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
