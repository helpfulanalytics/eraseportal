"use client";

/**
 * Debounced autosave, shared by the block editor and the canvas.
 *
 * There is no Save button in either — Notion and Miro don't have one, and a
 * document that needs one is a document people lose work in. What replaces it
 * is this: every mutation calls `schedule(next)`, edits inside the debounce
 * window collapse into one write, and the status pill tells the truth about
 * where the work currently is.
 *
 * Three things it deliberately does:
 *
 * - **Coalesces.** Only the newest value is ever sent; a save already in
 *   flight isn't cancelled, the next one just runs after it.
 * - **Flushes on unmount.** Clicking a sidebar link half a second after
 *   typing would otherwise drop that last edit. The flush is fire-and-forget
 *   — the component is gone, there's nobody left to show an error to — which
 *   is why the pill reports `unsaved` for the whole pending window rather
 *   than optimistically claiming "Saved".
 * - **Never schedules from a render.** `schedule` is called from event
 *   handlers only, so there's no effect watching a value and setting state,
 *   which the project's React Compiler lint rule rejects.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

/**
 * All the mutable state of one autosave loop, in a single ref.
 *
 * The drain loop below is recursive — a save that finishes with another value
 * already queued immediately starts again — and a recursive `useCallback`
 * defeats the React Compiler's memoization analysis. Hoisting the loop to
 * module scope and handing it this box keeps it a plain function.
 */
interface Engine<T> {
  action: (value: T) => Promise<unknown>;
  setState: (state: SaveState) => void;
  pending: { value: T } | null;
  inFlight: boolean;
  mounted: boolean;
}

async function drain<T>(engine: Engine<T>): Promise<void> {
  if (engine.inFlight || !engine.pending) return;

  const { value } = engine.pending;
  engine.pending = null;
  engine.inFlight = true;
  engine.setState("saving");

  try {
    await engine.action(value);
    // Something typed while this was in flight leaves the pill honest.
    if (engine.mounted) engine.setState(engine.pending ? "unsaved" : "saved");
  } catch {
    // The value has left `pending`, but the editor still holds it in state —
    // the next edit re-sends everything, so a failed save costs a retry, not
    // the document.
    if (engine.mounted) engine.setState("error");
  } finally {
    engine.inFlight = false;
    if (engine.pending) void drain(engine);
  }
}

export function useAutosave<T>(
  action: (value: T) => Promise<unknown>,
  delay = 900,
): { state: SaveState; schedule: (value: T) => void; flush: () => void } {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engine = useRef<Engine<T>>({
    action,
    setState,
    pending: null,
    inFlight: false,
    mounted: true,
  });

  // Keep the latest closure without changing `schedule`'s identity — a new
  // `schedule` each render would restart every debounce that depends on it.
  // Only `action` needs refreshing: React guarantees a `useState` setter is
  // stable for the life of the component, so the one captured above stays
  // correct.
  useEffect(() => {
    engine.current.action = action;
  });

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    void drain(engine.current);
  }, []);

  const schedule = useCallback(
    (value: T) => {
      engine.current.pending = { value };
      setState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void drain(engine.current);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    const current = engine.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      if (timer.current) clearTimeout(timer.current);
      if (current.pending) void current.action(current.pending.value);
    };
  }, []);

  return { state, schedule, flush };
}
