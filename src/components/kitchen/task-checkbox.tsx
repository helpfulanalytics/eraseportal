"use client";

/**
 * Completion toggle for a task row.
 *
 * Optimistic: the box flips immediately and the server catches up. A task
 * checkbox that waits ~300ms on a round trip before responding feels broken,
 * and the failure here is cheap to undo — on error the state reverts and the
 * row stays where it was.
 *
 * Note that the tasks list is filtered by completion, so a successful toggle
 * removes the row from the current view once the route revalidates. That's
 * intended, and it's why the optimistic state doesn't need to be reconciled:
 * the row is gone by then.
 */
import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toggleTaskAction } from "@/app/(workspace)/actions";
import { cn } from "@/lib/utils";

export function TaskCheckbox({
  taskId,
  completed,
  title,
}: {
  taskId: string;
  completed: boolean;
  /** Announced to screen readers so the control isn't just "checkbox". */
  title: string;
}) {
  const [checked, setChecked] = useState(completed);
  const [, startTransition] = useTransition();

  const toggle = () => {
    const next = !checked;
    setChecked(next);

    startTransition(async () => {
      try {
        await toggleTaskAction(taskId, next);
      } catch {
        setChecked(!next);
      }
    });
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={`Mark "${title}" ${checked ? "not done" : "done"}`}
      onClick={toggle}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-k-blue bg-k-blue text-k-white"
          : "border-k-black-24 bg-background hover:border-k-black-40",
      )}
    >
      {checked ? <CheckIcon className="size-3" strokeWidth={2.6} /> : null}
    </button>
  );
}
