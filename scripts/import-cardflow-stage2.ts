/**
 * Stage 2 of the CardFlow engagement: a new folder for the signed 6-month
 * support contract's kickoff work (Spinwheel integration + production
 * launch), seeded from Chelsea Rogers's Sep 7, 2026 kickoff email.
 *
 * Creates the folder inside the existing CardFlowFinancial project
 * (alongside the migrated-history folder from stage 1), one placeholder
 * Document per real attachment Chelsea sent (the actual file bytes aren't
 * recoverable from the PDF printout of the email — each page notes what's
 * expected and that the real file needs to replace it), and a board seeded
 * with the concrete task list from that email.
 *
 *   npm run import:cardflow-stage2
 */
import { randomUUID } from "crypto";
import { adminDb } from "../src/lib/firebase/admin";
import { createFolder, createDocument, createBoard } from "../src/lib/kitchen-data";
import type { DocBlock, BoardCard } from "../src/lib/kitchen-types";

const COLLECTIONS = {
  items: "items",
  documents: "documents",
  boards: "boards",
  organizations: "organizations",
} as const;

const ORGANIZATION_ID = "C2N8yK8N9cZ0fyRLncIH"; // CardFlowFinancial project
const TOSIN_ID = "EhbrdPZ8aNRWsQViQCbCs5W0KI23";
const BROOKS_ID = "QXs9IsSK38KoSKlPsJ5Z";
const CHELSEA_ID = "B1X166afyREoCUPv3PhD";

function textBlock(html: string): DocBlock {
  return { id: randomUUID(), type: "text", html };
}

const PENDING_NOTE =
  '<i>Status: pending upload — replace this page with the real file Chelsea attached on Sep 7, 2026.</i>';

interface DocSeed {
  name: string;
  approxSize: string;
  body: string;
}

const DOCS: DocSeed[] = [
  {
    name: "Consumer ACH Debit Authorization Review (Fillable)",
    approxSize: "~308 KB, PDF",
    body:
      "Spinwheel's required review form for CardFlow's ACH debit-authorization flow. " +
      "The implementation must capture and retain: the consumer's identity, the authorized debit amount, " +
      "the timing/frequency of the debit, clear revocation instructions, the date/time of consent, a session " +
      "or transaction record tied to the authorization, and a copy of the exact authorization language accepted. " +
      "Records must be retained at least 2 years after revocation/termination and retrievable within 2 business " +
      "days. Chelsea also needs screenshots of the completed consent/authorization flow to submit to Spinwheel " +
      "— she signs the company attestation, we provide the technical implementation and supporting evidence.",
  },
  {
    name: "CardFlow Complaint Policy (8.19.2026)",
    approxSize: "~46 KB, DOCX",
    body:
      "CardFlow's complaint-handling policy — one of the compliance policies Chelsea sent as an implementation " +
      "requirement so the technical build stays aligned with what's documented for Spinwheel/production review.",
  },
  {
    name: "CardFlow Business Continuity & Disaster Recovery Plan (8.19.2026)",
    approxSize: "~42 KB, DOCX",
    body:
      "CardFlow's business continuity / disaster recovery plan — a compliance policy Chelsea sent so the " +
      "technical implementation (deployment, monitoring, incident handling) stays consistent with it.",
  },
  {
    name: "CardFlow Compliance Management System Policy (8.19.2026)",
    approxSize: "~46 KB, DOCX",
    body:
      "CardFlow's compliance management system policy — sent alongside the other policies as a technical " +
      "implementation requirement ahead of production launch.",
  },
  {
    name: "CardFlow Information Security Policy (8.19.2026)",
    approxSize: "~75 KB, DOCX",
    body:
      "CardFlow's information security policy — relevant to the production deployment, key handling, and " +
      "logging/monitoring work in this stage.",
  },
  {
    name: "CardFlow High-Level Fraud Controls Summary (8.19.2026)",
    approxSize: "~45 KB, DOCX",
    body:
      "Summary of CardFlow's fraud controls — relevant to the settlement/rejection/retry handling and " +
      "ACH authorization work in this stage.",
  },
  {
    name: "CardFlow Incident Response Plan (8.19.2026)",
    approxSize: "~37 KB, DOCX",
    body:
      "CardFlow's incident response plan — relevant to the logging, monitoring, and alerting work planned " +
      "for production readiness.",
  },
];

interface CardSeed {
  column: "col_todo" | "col_progress" | "col_blocked" | "col_done";
  title: string;
  description: string;
  labels: string[];
}

const CARDS: CardSeed[] = [
  {
    column: "col_progress",
    title: "Spinwheel consent language — Identity Verification step",
    description:
      'Add the Spinwheel-required consent text to the Identity Verification step, linking to the Spinwheel ' +
      'End User Agreement (https://spinwheel.io/legal/end-user-agreement): "By continuing, you agree to the ' +
      "Spinwheel End User Agreement. Further, you are providing 'written instructions' to Spinwheel Solutions, " +
      'Inc. authorizing Spinwheel & CardFlow to obtain your credit profile from any consumer reporting agency." ' +
      "Direct compliance request — prioritize per Chelsea's Sep 7 email.",
    labels: ["Compliance", "High priority"],
  },
  {
    column: "col_progress",
    title: "Consumer ACH debit authorization implementation",
    description:
      "Payment flow must capture and retain: consumer identity, authorized debit amount, timing/frequency, " +
      "revocation instructions, date/time of consent, a session/transaction record tied to the authorization, " +
      "and the exact authorization language accepted. Retain 2+ years post-revocation, retrievable within 2 " +
      "business days. Produce screenshots of the completed flow for Chelsea to submit to Spinwheel. See the " +
      "Consumer ACH Debit Authorization Review doc in this folder. Direct compliance request — prioritize.",
    labels: ["Compliance", "High priority"],
  },
  {
    column: "col_todo",
    title: "End-to-end sandbox testing",
    description: "Full sandbox test pass ahead of production readiness.",
    labels: ["Testing"],
  },
  {
    column: "col_todo",
    title: "Verify settlement, rejection, return & retry scenarios",
    description: "Confirm each payment-lifecycle edge case behaves correctly in sandbox.",
    labels: ["Testing"],
  },
  {
    column: "col_todo",
    title: "Document test results and unresolved issues",
    description: "Write up sandbox test results and anything still open, for Chelsea's visibility.",
    labels: ["Testing"],
  },
  {
    column: "col_todo",
    title: "Production deployment support",
    description: "Support the deployment itself once sandbox testing is signed off.",
    labels: ["Launch"],
  },
  {
    column: "col_todo",
    title: "Logging, monitoring & alerting",
    description: "Stand up production logging/monitoring/alerting before go-live.",
    labels: ["Launch"],
  },
  {
    column: "col_todo",
    title: "Sandbox → production key transition",
    description: "Move CardFlow from sandbox credentials to production keys.",
    labels: ["Launch"],
  },
  {
    column: "col_todo",
    title: "Launch support for first transactions & users",
    description: "Be available for CardFlow's first real transactions and onboarded users.",
    labels: ["Launch"],
  },
  {
    column: "col_todo",
    title: "Send Chelsea: implementation plan, 72-hr estimate, timeline, blockers",
    description:
      "Chelsea asked for: the access our team needs (she'll add us to the Spinwheel contact list), our " +
      "recommended implementation plan, an estimate of hours from the 72-hour bank, any questions/blockers, " +
      "and a proposed timeline for the Spinwheel work.",
    labels: ["Deliverable"],
  },
  {
    column: "col_blocked",
    title: "Get Spinwheel contact-list access from Chelsea",
    description: "Chelsea offered to add our team to the Spinwheel contact list once we send our access needs.",
    labels: ["Waiting on client"],
  },
];

async function main() {
  const db = adminDb();
  console.log(`Building CardFlow stage-2 folder in ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

  const org = await db.collection(COLLECTIONS.organizations).doc(ORGANIZATION_ID).get();
  if (!org.exists) throw new Error(`organization ${ORGANIZATION_ID} not found`);
  console.log(`  org: ${org.data()?.name}`);

  const folder = await createFolder({
    name: "CardFlow — Spinwheel & Launch Support",
    description: "Stage 2: signed 6-month support engagement (Spinwheel integration, production launch).",
    access: "clients",
    organizationId: ORGANIZATION_ID,
  });
  console.log(`  created folder "${folder.name}" (${folder.id})`);

  for (const seed of DOCS) {
    const doc = await createDocument({
      folderId: folder.id,
      name: seed.name,
      authorId: BROOKS_ID,
    });
    const content: DocBlock[] = [
      textBlock(`${seed.body} (${seed.approxSize})`),
      textBlock(PENDING_NOTE),
    ];
    await db.collection(COLLECTIONS.documents).doc(doc.id).update({ content });
    await db.collection(COLLECTIONS.items).doc(doc.id).update({
      "meta.preview": seed.body.slice(0, 200),
    });
    console.log(`  created document "${seed.name}" (${doc.id})`);
  }

  const board = await createBoard({
    folderId: folder.id,
    name: "CardFlow — Spinwheel & Launch Support",
    authorId: BROOKS_ID,
  });

  const now = new Date().toISOString();
  const columns = board.columns.map((column) => ({
    ...column,
    cards: CARDS.filter((c) => c.column === column.id).map(
      (c): BoardCard => ({
        id: randomUUID(),
        title: c.title,
        description: c.description,
        labels: c.labels,
        authorId: BROOKS_ID,
        createdAt: now,
      }),
    ),
  }));
  const cardCount = CARDS.length;

  await db.collection(COLLECTIONS.boards).doc(board.id).update({ columns });
  await db.collection(COLLECTIONS.items).doc(board.id).update({
    "meta.cardCount": cardCount,
  });
  console.log(`  created board "${board.name}" (${board.id}) with ${cardCount} cards`);

  console.log("\nDone.");
  console.log(`Folder: /w/<org-slug>/folders/${folder.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
