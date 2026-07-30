import { redirect } from "next/navigation";

/**
 * Superseded by the dashboard (`/`), which lists every organization for an
 * admin — clients now live per-org, under each org's own Settings → Members.
 * Kept as a redirect rather than deleted outright so any bookmarked or
 * linked `/clients` URL still lands somewhere real.
 */
export default function ClientsPage() {
  redirect("/");
}
