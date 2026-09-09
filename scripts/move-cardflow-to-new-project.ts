/**
 * Detaches the CardFlowFinancial folder (and its client, Chelsea Rogers)
 * from the "Cardflow Financial [internal notes]" project and moves them
 * into their own new project, using the same createOrganization() path the
 * "+ New Project" UI uses.
 */
import { adminDb } from "../src/lib/firebase/admin";
import { createOrganization, setOrganizationDefaultClientAccess } from "../src/lib/kitchen-data";

const FOLDER_ID = "SKYGA5Jcb0zOFYiTKBBp";
const CHELSEA_ID = "B1X166afyREoCUPv3PhD";

async function main() {
  const db = adminDb();

  const organization = await createOrganization({
    name: "CardFlowFinancial",
    domain: "https://www.cardflowfinancial.com/",
  });
  await setOrganizationDefaultClientAccess(organization.id, "view");
  console.log(`Created project "${organization.name}" (${organization.id}, slug: ${organization.slug})`);

  await db.collection("folders").doc(FOLDER_ID).update({ organizationId: organization.id });
  console.log(`Moved folder ${FOLDER_ID} -> ${organization.id}`);

  await db.collection("people").doc(CHELSEA_ID).update({ organizationId: organization.id });
  console.log(`Moved chelsea person ${CHELSEA_ID} -> ${organization.id}`);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
