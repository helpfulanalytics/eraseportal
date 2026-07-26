"use client";

import { usePeople } from "@/components/workspace-provider";
import { formatShortDate } from "@/lib/kitchen-format";
import type { Task } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_TINT: Record<string, string> = {
  todo: "bg-k-black-06 text-k-black-72",
  in_progress: "bg-k-blue-08 text-k-blue",
  done: "bg-k-green-23 text-k-green-0e",
};

/**
 * Month grid for tasks with due dates. Anchors on the month of the earliest
 * due task rather than "today", so the view isn't empty when the mock data
 * sits in a different month.
 */
export function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const people = usePeople();
  const dated = tasks.filter((t) => t.dueDate);

  if (dated.length === 0) {
    return (
      <div className="border-k-black-06 border-y py-16 text-center text-k-black-40 text-md">
        No tasks with due dates.
      </div>
    );
  }

  const anchor = new Date(
    `${dated.map((t) => t.dueDate as string).sort()[0]}T00:00:00Z`,
  );
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();

  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Convert Sunday-first (0) to Monday-first (0 = Monday).
  const leading = (first.getUTCDay() + 6) % 7;

  const cells: Array<{ day: number | null; key: string }> = [
    ...Array.from({ length: leading }, (_, i) => ({
      day: null,
      key: `pad-${i}`,
    })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      key: `day-${i + 1}`,
    })),
  ];
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: `tail-${cells.length}` });
  }

  const byDay = new Map<number, Task[]>();
  for (const task of dated) {
    const d = new Date(`${task.dueDate as string}T00:00:00Z`);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month) continue;
    const day = d.getUTCDate();
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }

  const monthLabel = first.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div>
      <div className="mb-3 font-medium text-k-black-84 text-md">
        {monthLabel}
      </div>

      <div className="grid grid-cols-7 border-k-black-06 border-t border-l">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-k-black-06 border-r border-b px-2 py-1.5 text-k-black-40 text-sm"
          >
            {day}
          </div>
        ))}

        {cells.map((cell) => {
          const dayTasks = cell.day ? (byDay.get(cell.day) ?? []) : [];
          return (
            <div
              key={cell.key}
              className={cn(
                "min-h-24 border-k-black-06 border-r border-b p-1.5",
                cell.day === null && "bg-k-black-02",
              )}
            >
              {cell.day !== null ? (
                <>
                  <div className="mb-1 text-k-black-40 text-sm">{cell.day}</div>
                  <ul className="flex flex-col gap-1">
                    {dayTasks.map((task) => (
                      <li key={task.id}>
                        <span
                          className={cn(
                            "block truncate rounded px-1.5 py-0.5 text-2xs",
                            STATUS_TINT[task.status] ??
                              "bg-k-black-06 text-k-black-72",
                          )}
                          title={`${task.title}${
                            task.assigneeId
                              ? ` — ${people[task.assigneeId]?.name}`
                              : ""
                          } (${formatShortDate(task.dueDate as string)})`}
                        >
                          {task.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
