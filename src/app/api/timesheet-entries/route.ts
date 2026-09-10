/**
 * Endpoint for logging a timesheet entry from outside the app — an agent
 * running in some other codebase, with no session cookie and no repo
 * access here.
 *
 * Auth is per-timesheet: each `Timesheet.apiToken` (see kitchen-types.ts)
 * is its own credential, scoped to that one timesheet, issued when the
 * timesheet is created and rotated on demand from its page (see
 * `regenerateTimesheetTokenAction`). There's no app-wide secret — a token
 * leaked from one codebase's connection can't touch any other project's
 * hours, and rotating one doesn't affect any other timesheet.
 *
 * A successful POST marks the timesheet "connected" (`markTimesheetConnected`),
 * which is the only signal the page has for whether an agent somewhere
 * actually holds a working token — there's no heartbeat, just "has this
 * token ever been used."
 */
import { NextResponse, type NextRequest } from "next/server";
import { createTimesheetEntry, getTimesheet, getTimesheetEntries, markTimesheetConnected } from "@/lib/kitchen-data";

/**
 * `?timesheetId=...&token=...` — the entry list, for an agent that wants to
 * confirm what's already logged before adding more.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const timesheetId = params.get("timesheetId");
  const token = params.get("token");
  if (!timesheetId || !token) {
    return NextResponse.json({ error: "timesheetId and token are required." }, { status: 400 });
  }

  const timesheet = await getTimesheet(timesheetId);
  if (!timesheet || timesheet.apiToken !== token) {
    return NextResponse.json({ error: "Invalid timesheetId or token." }, { status: 401 });
  }

  const entries = await getTimesheetEntries(timesheetId);
  return NextResponse.json({
    timesheet: { id: timesheet.id, name: timesheet.name },
    entries,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { timesheetId, token, notes, hours, date } = body;
  if (typeof timesheetId !== "string" || !timesheetId) {
    return NextResponse.json({ error: "timesheetId is required." }, { status: 400 });
  }
  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token is required." }, { status: 400 });
  }
  if (typeof notes !== "string" || !notes.trim()) {
    return NextResponse.json({ error: "notes is required." }, { status: 400 });
  }
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ error: "hours must be a positive number." }, { status: 400 });
  }
  if (date !== undefined && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  const timesheet = await getTimesheet(timesheetId);
  if (!timesheet || timesheet.apiToken !== token) {
    return NextResponse.json({ error: "Invalid timesheetId or token." }, { status: 401 });
  }

  // No signed-in person on this path — entries logged here are attributed
  // to the timesheet's own author, same convention a system write elsewhere
  // in this codebase falls back to when there's no real actor to credit.
  const entry = await createTimesheetEntry({
    timesheetId,
    authorId: timesheet.authorId ?? "api",
    notes: notes.trim(),
    hours,
    date,
  });

  await markTimesheetConnected(timesheetId);

  return NextResponse.json({ entry }, { status: 201 });
}
