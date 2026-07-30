import { redirect } from "next/navigation";

/**
 * Retired — the dashboard (`/`) already lists every organization for an
 * admin (it's the org picker now), so a separate bare list page duplicated
 * it. Kept as a redirect so an old bookmark or link still lands somewhere.
 */
export default function AdminOrgListPage() {
  redirect("/");
}
