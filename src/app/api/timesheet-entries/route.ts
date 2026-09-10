/**
 * Shared-secret endpoint for logging timesheet entries from outside the
 * app — the same shape as the Google Sheets worklog webhook this repo's
 * hours already go through, so an agent (or any script) can append an
 * entry with one POST, no session cookie or repo access required.
 *
 * Auth is a secret compared against `TIMESHEET_API_SECRET`, not a Firebase
 * session — there's no browser involved on this path. `secret` travels in
 * the POST body (matching the Sheets webhook's convention) and as a query
 * param on GET, since a GET request has no body to carry it in.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createTimesheetEntry, getTimesheet, getTimesheetEntries, getTimesheets } from "@/lib/kitchen-data";

function checkSecret(provided: string | null): boolean {
  const expected = process.env.TIMESHEET_API_SECRET;
  return Boolean(expected) && provided === expected;
}

/**
 * `?secret=...` alone lists every timesheet (id, name, folderId) — discovery
 * for whoever's calling this without repo access to look ids up directly.
 * `?secret=...&timesheetId=...` instead lists that one timesheet's entries.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (!checkSecret(params.get("secret"))) {
    return NextResponse.json({ error: "Invalid secret." }, { status: 401 });
  }

  const timesheetId = params.get("timesheetId");
  if (timesheetId) {
    const timesheet = await getTimesheet(timesheetId);
    if (!timesheet) {
      return NextResponse.json({ error: "That timesheet doesn't exist." }, { status: 404 });
    }
    const entries = await getTimesheetEntries(timesheetId);
    return NextResponse.json({ timesheet, entries });
  }

  const timesheets = await getTimesheets();
  return NextResponse.json({
    timesheets: timesheets.map((t) => ({ id: t.id, name: t.name, folderId: t.folderId })),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!checkSecret(body.secret ?? null)) {
    return NextResponse.json({ error: "Invalid secret." }, { status: 401 });
  }

  const { timesheetId, notes, hours, date } = body;
  if (typeof timesheetId !== "string" || !timesheetId) {
    return NextResponse.json({ error: "timesheetId is required." }, { status: 400 });
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
  if (!timesheet) {
    return NextResponse.json({ error: "That timesheet doesn't exist." }, { status: 404 });
  }

  // No signed-in person on this path — entries logged here are attributed
  // to the timesheet's own author, same convention as a seeded/system write
  // elsewhere in this codebase having no better `authorId` to reach for.
  const entry = await createTimesheetEntry({
    timesheetId,
    authorId: timesheet.authorId ?? "api",
    notes: notes.trim(),
    hours,
    date,
  });

  return NextResponse.json({ entry }, { status: 201 });
}
