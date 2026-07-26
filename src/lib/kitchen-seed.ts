/**
 * The original mock dataset, kept verbatim as Firestore seed input.
 *
 * This is no longer what the app renders — `kitchen-data.ts` reads Firestore.
 * It survives for two reasons: `scripts/seed-firestore.ts` writes exactly this
 * into an empty project, and it remains the reference for what a correctly
 * populated workspace looks like when a query returns something surprising.
 *
 * Content mirrors the scan in docs/kitchen-scan.md. Don't edit it to change
 * what the app shows — edit Firestore.
 */
import type {
  Block,
  Board,
  Company,
  Conversation,
  Embed,
  Folder,
  FolderItem,
  InboxEntry,
  Inline,
  KDocument,
  Message,
  Person,
  Task,
  Template,
  Workspace,
} from "./kitchen-types";

export const WORKSPACE: Workspace = {
  id: "ws_kea",
  name: "Kea Marketing LLC",
};

export const PEOPLE: Record<string, Person> = {
  tosin: {
    id: "tosin",
    name: "allioluwatosin",
    handle: "allioluwatosin",
    email: "victorvoca16@gmail.com",
    initials: "AO",
    color: "var(--k-purple)",
    kind: "member",
  },
  brooks: {
    id: "brooks",
    name: "Brooks Conkle",
    handle: "brooks",
    email: "brooks@keamarketing.com",
    initials: "BC",
    color: "var(--k-green-0e)",
    kind: "member",
  },
  chelsea: {
    id: "chelsea",
    name: "Chelsea Rogers",
    handle: "chelsea",
    email: "chelsea@cardflowfinancial.com",
    initials: "CR",
    color: "var(--k-blue)",
    kind: "client",
  },
};

/** The signed-in user — decides which messages render as "own". */
export const CURRENT_USER_ID = "tosin";

export const FOLDERS: Folder[] = [
  {
    id: "fo_c907da8493d24cca985038f9",
    name: "CardFlowFinancial",
    url: "https://www.cardflowfinancial.com/",
    starred: false,
    itemIds: [
      "convr_fd4e534129a61d43acf7e435",
      "brd_9f2c4a71e08d",
      "doc_4b71ca9e2f30",
      "emb_7c15de8a03b2",
      "it_overview",
      "it_pricing",
      "it_agreement",
      "it_milestone1",
    ],
  },
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "convr_fd4e534129a61d43acf7e435",
    name: "CardFlow - Chelsea / Brooks / Tosin",
    folderId: "fo_c907da8493d24cca985038f9",
    participantIds: ["tosin", "brooks", "chelsea"],
    starred: false,
  },
];

export const FOLDER_ITEMS: FolderItem[] = [
  {
    id: "convr_fd4e534129a61d43acf7e435",
    kind: "conversation",
    name: "CardFlow - Chelsea / Brooks / Tosin",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-03-27",
    authorId: "brooks",
    meta: { type: "conversation", messageCount: 70 },
  },
  {
    id: "brd_9f2c4a71e08d",
    kind: "board",
    name: "CardFlow — Path to Production",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-04-08",
    authorId: "tosin",
    meta: { type: "board", cardCount: 9 },
  },
  {
    id: "doc_4b71ca9e2f30",
    kind: "document",
    name: "Spinwheel webhook configuration",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-06-10",
    authorId: "chelsea",
    meta: { type: "document", updatedAt: "2026-06-15" },
  },
  {
    id: "emb_7c15de8a03b2",
    kind: "embed",
    name: "Sandbox app",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-06-26",
    authorId: "tosin",
    meta: { type: "embed", provider: "Vercel" },
  },
  {
    id: "it_overview",
    kind: "file",
    name: "cardflow-overview.pdf",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-03-11",
    authorId: "chelsea",
    meta: { type: "file", mime: "application/pdf", label: "PDF", bytes: 40700 },
  },
  {
    id: "it_pricing",
    kind: "file",
    name: "CardFlow Proposal - Pricing Breakdown.pdf",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-03-26",
    authorId: "brooks",
    meta: { type: "file", mime: "application/pdf", label: "PDF", bytes: 77450 },
  },
  {
    id: "it_agreement",
    kind: "file",
    name: "CardFlow Financial - signed agreement.pdf",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-04-01",
    authorId: "chelsea",
    meta: { type: "file", mime: "application/pdf", label: "PDF", bytes: 90750 },
  },
  {
    id: "it_milestone1",
    kind: "file",
    name: "milestone_1.pdf",
    folderId: "fo_c907da8493d24cca985038f9",
    createdAt: "2026-04-03",
    authorId: "tosin",
    meta: { type: "file", mime: "application/pdf", label: "PDF", bytes: 70670 },
  },
];

const CONV = "convr_fd4e534129a61d43acf7e435";

/** Shorthand for a paragraph of plain text. */
const p = (v: string): Block => ({ b: "p", children: [{ t: "text", v }] });

/**
 * Bullet list from the natural authoring shape (an array of inline runs),
 * wrapping each run in the `{ children }` object the stored form requires.
 * See the note on `Block` in kitchen-types.ts — Firestore can't hold an array
 * nested directly inside another array.
 */
const ul = (items: Inline[][]): Block => ({
  b: "ul",
  items: items.map((children) => ({ children })),
});

export const MESSAGES: Message[] = [
  {
    id: "msg_a1f2c3d4e5b60718",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-05-29T09:12:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hi " },
          { t: "mention", personId: "tosin" },
          { t: "text", v: "!" },
        ],
      },
      p("I'm really excited to see the progress on the Spinwheel implementation and it's great to see CardFlow continuing to move forward."),
      p("As we get further along, Spinwheel will want to connect with us to walk through the path to production, implementation review, compliance requirements, and eventually production key provisioning. Would you be available to join that call when the time comes?"),
      p("I'd also love to connect before then to touch base, review progress, and officially meet face to face."),
      p("Thanks again for taking on this project. I really appreciate the time, effort, and expertise you've already invested in CardFlow, and I'm looking forward to continuing to build this together."),
      p("Looking forward to connecting soon!"),
    ],
  },
  {
    id: "msg_b2c3d4e5f6a71829",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-05-29T09:20:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Also, this is what we had for frontend if you'd like to take a look. " },
          { t: "link", href: "https://product.cardflowfinancial.com" },
        ],
      },
    ],
  },
  {
    id: "msg_c3d4e5f6a7b8293a",
    conversationId: CONV,
    authorId: "brooks",
    createdAt: "2026-05-30T14:02:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hey " },
          { t: "mention", personId: "chelsea" },
          { t: "text", v: " -- payment received, thanks." },
        ],
      },
      p("We're happy to try to link up for an in person meet up >> typically Tosin and I stick to writing so that we can more easily track convos. Plus, we're on completely different timezones and have different accents (I'm a Southern Alabama guy and he's currently living in Nigeria!)"),
      p("re: Spinwheel, etc. >> we're 100% happy to figure out the best way to help move it forward. Even if we can't make the call, I'd recommend recording it so that we have a transcript and clear understanding for how we need to work with them."),
      p("Also open to any other ideas to keep your project moving forward and keeping it streamlined."),
      p("Thanks!"),
    ],
  },
  {
    id: "msg_d4e5f6a7b8c93a4b",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-02T10:30:00Z",
    body: [
      p("Sounds great, and that makes perfect sense."),
      p("I completely understand the preference for written communication, especially with time zones involved. I appreciate you both being willing to support the Spinwheel implementation and production process as we move forward."),
      p("I agree that recording the Spinwheel calls and sharing transcripts will probably be the best approach so everyone stays aligned and has visibility into requirements, compliance items, and next steps."),
      p("I'll keep you posted as we get closer to those conversations. In the meantime, if anything comes up on the implementation side that needs my input or coordination with Spinwheel, just let me know."),
      p("Excited to keep moving this forward. Thanks again for all the work you and Tosin are putting into CardFlow."),
    ],
  },
  {
    id: "msg_e5f6a7b8c9d4ab5c",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-03T11:05:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hey " },
          { t: "mention", personId: "tosin" },
          { t: "text", v: "," },
        ],
      },
      p("Quick question, would it be possible for me to access the current build and start testing some of the Spinwheel flows?"),
      p("I'd like to walk through the user experience from the frontend while also helping verify that the data is making it through to the backend correctly. It would be helpful for me to see how everything is working end to end and identify any issues, questions, or feedback early."),
      p("If there are any specific flows you'd like me to focus on or any test credentials I should use, just let me know."),
      p("Thanks so much!"),
    ],
  },
  {
    id: "msg_f6a7b8c9d0e5bc6d",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-05T08:44:00Z",
    body: [
      p("Hey guys, do you mind sharing the updated timelines for Phases 2 and 3? I'm working through some planning and timeline updates on my end and want to make sure my dates are aligned. Thanks!"),
      {
        b: "p",
        children: [
          { t: "mention", personId: "brooks" },
          { t: "text", v: " " },
          { t: "mention", personId: "tosin" },
        ],
      },
    ],
  },
  {
    id: "msg_a7b8c9d0e1f6cd7e",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-06-10T07:15:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "hey " },
          { t: "mention", personId: "chelsea" },
        ],
      },
      p("milestone 2 is complete and we're almost done with the third milestone"),
      p("i need more access to the spinwheel dashboard - i cant find the webhook secret im just blocked on that end"),
      p("i should send a full overview of the entire system by saturday if i can get access to the webhook secrets as sson as possible thanks."),
    ],
  },
  {
    id: "msg_b8c9d0e1f2a7de8f",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-06-10T12:40:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hey " },
          { t: "mention", personId: "chelsea" },
          {
            t: "text",
            v: " , just wanted to send a quick overview of how everything fits together before I send the full breakdown Saturday.",
          },
        ],
      },
      {
        b: "p",
        children: [
          { t: "text", v: "Stripe", bold: true },
          { t: "text", v: " — handles the $10/month CardFlow subscription. That's all it does." },
        ],
      },
      {
        b: "p",
        children: [
          { t: "text", v: "Plaid", bold: true },
          {
            t: "text",
            v: " — handles bank account linking. When a user connects their bank, Plaid verifies it and passes the account details directly to Spinwheel so the user is ready to pay instantly.",
          },
        ],
      },
      {
        b: "p",
        children: [
          { t: "text", v: "Spinwheel", bold: true },
          {
            t: "text",
            v: " — handles the actual split payments. When a user submits $407 across three cards, Spinwheel pulls the full amount from their bank, then routes the exact right amount to each card issuer — $120 to Chase, $231 to Amex, $56 to Capital One.",
          },
        ],
      },
      p("The user only makes one payment. We handle the routing."),
      p("Wanted to make sure we're aligned on this before going further — does this match your vision for how the system should work?"),
    ],
  },
  {
    id: "msg_264c27d9c13da38a5653b05e",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-10T15:02:00Z",
    body: [
      p("Hey Tosin,"),
      p("Yes, that flow matches my vision for CardFlow, perfectly!"),
      p("Thank you for the update on Milestones 2 and 3. I appreciate the progress and am looking forward to the full system overview on Saturday."),
      p("I'll look into the webhook secret blocker ASAP and see what I can do to get you unblocked."),
      p("One quick question: I received a Vercel notification regarding a membership request associated with kessasoro@gmail.com (kessasoro-1545). Can you confirm who this is and whether they are part of your development team?"),
      p("Before I approve any access, I'd like to understand their role and what level of access they'll need."),
      p("Thanks!"),
    ],
  },
  {
    id: "msg_c9d0e1f2a3b8ef90",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-10T15:03:00Z",
    body: [{ b: "p", children: [{ t: "mention", personId: "tosin" }] }],
  },
  {
    id: "msg_d0e1f2a3b4c9f0a1",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-06-10T16:20:00Z",
    body: [
      p("its a keychain problem from my mac and vercel - im sorting it out"),
      p("thats my second account"),
    ],
    reactions: [{ emoji: "👍", personIds: ["chelsea"] }],
  },
  {
    id: "msg_e1f2a3b4c5d0a1b2",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-10T18:45:00Z",
    body: [
      p("Hey Tosin,"),
      p("I spent some time digging through the Spinwheel documentation regarding the webhook configuration."),
      p("From what I'm seeing, Spinwheel does not appear to provide a separate webhook secret key the way some providers (Stripe, etc.) do. Their webhook implementation seems to work differently."),
      p("According to the documentation:"),
      ul([
          [{ t: "text", v: "Webhooks are created through the Spinwheel dashboard/API." }],
          [{ t: "text", v: "Webhooks support custom authentication headers that can be configured by the partner." }],
          [{ t: "text", v: "Spinwheel will include those headers on every webhook POST request." }],
          [{ t: "text", v: "Webhook security is expected to be handled through a combination of custom authentication headers and IP whitelisting." }],
      ]),
      p("Spinwheel stated that webhook authentication is handled through custom headers rather than a platform generated webhook secret."),
      {
        b: "p",
        children: [{ t: "text", v: "Sandbox IPs", bold: true }],
      },
      ul([
          [{ t: "text", v: "34.203.72.127" }],
          [{ t: "text", v: "52.2.114.95" }],
          [{ t: "text", v: "52.12.60.65" }],
      ]),
      {
        b: "p",
        children: [{ t: "text", v: "Production IPs", bold: true }],
      },
      ul([[{ t: "text", v: "44.232.30.137" }], [{ t: "text", v: "3.230.55.249" }]]),
      {
        b: "p",
        children: [{ t: "link", href: "https://docs.spinwheel.io/docs/webhooks" }],
      },
      p("Key Takeaway — instead of a shared secret, your team should implement header-based authentication and IP whitelisting to secure the webhook endpoint."),
      p("Please let me know if this helps, if not I will reach out to Spinwheel."),
    ],
  },
  {
    id: "msg_f2a3b4c5d6e1b2c3",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-15T09:30:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hi " },
          { t: "mention", personId: "tosin" },
          {
            t: "text",
            v: ", I hope you had a great weekend! Please let me know if this webhook info helped. I can get in touch with the Spinwheel engineers if needed. Thanks! ☺️",
          },
        ],
      },
    ],
  },
  {
    id: "msg_a3b4c5d6e7f2c3d4",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-06-15T13:10:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hey " },
          { t: "mention", personId: "chelsea" },
          { t: "text", v: " thank you! it did" },
        ],
      },
      p("i was reading the old documentation, im doing end to end tests right now"),
    ],
    reactions: [{ emoji: "🎉", personIds: ["chelsea"] }],
  },
  {
    id: "msg_b4c5d6e7f8a3d4e5",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-06-23T08:00:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "hey " },
          { t: "mention", personId: "chelsea" },
          { t: "text", v: " heres the entire flow of the entire system running in the sandbox environment." },
        ],
      },
      {
        b: "p",
        children: [{ t: "link", href: "https://somup.com/cO1q0MVnhVd" }],
      },
    ],
    reactions: [{ emoji: "🔥", personIds: ["chelsea"] }],
  },
  {
    id: "msg_c5d6e7f8a9b4e5f6",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-23T16:20:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hi " },
          { t: "mention", personId: "tosin" },
          { t: "text", v: " ," },
        ],
      },
      p("Thank you for sharing the walkthrough. Everything is looking great, and I'm excited to see the full flow coming together."),
      p("As we move closer to launch, I'd like to make sure I have visibility into the operational side of the platform as well and to the sandbox environment, including the sandbox URL, any test credentials, so I can begin running my own validation and testing scenarios."),
      p("Additionally, if there is any documentation around environment setup, deployments, integrations, or architecture, I'd appreciate having that as part of our handoff and launch preparation process."),
      p("Thanks again for all your work on this."),
    ],
  },
  {
    id: "msg_d6e7f8a9b0c5f6a7",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-06-26T11:00:00Z",
    body: [
      {
        b: "p",
        children: [
          { t: "text", v: "Hi " },
          { t: "mention", personId: "chelsea" },
          { t: "text", v: "," },
        ],
      },
      p("Thanks for the kind words — glad the walkthrough landed well!"),
      {
        b: "p",
        children: [{ t: "text", v: "Sandbox environment is live and ready for your testing:", bold: true }],
      },
      ul([
          [
            { t: "text", v: "App URL: " },
            { t: "link", href: "https://frontend-sandbox-mu.vercel.app" },
          ],
          [
            { t: "text", v: "API URL: " },
            { t: "link", href: "https://backend-sandbox-six.vercel.app/api" },
          ],
      ]),
      p("It runs entirely in test/sandbox mode (Stripe and Plaid sandbox, no real money or real bank credentials involved), so feel free to put it through its paces."),
      {
        b: "p",
        children: [
          { t: "text", v: "For access: please self-register at " },
          { t: "text", v: "/register", bold: true },
          { t: "text", v: " — that way you have your own account rather than shared credentials. When linking a bank account, use Plaid's test institution login (user_good / pass_good)." },
        ],
      },
      p("I've attached the full handoff document, which covers architecture, every integration in play, environment configuration, deployment instructions, and a detailed Path to Production checklist."),
      p("Let me know once you've had a chance to run through it."),
    ],
    attachments: [
      {
        id: "att_handoff",
        name: "SANDBOX_HANDOFF.pdf",
        label: "PDF",
        bytes: 218930,
      },
    ],
  },
  {
    id: "msg_e7f8a9b0c1d6a7b8",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-29T10:15:00Z",
    body: [
      p("Hi Tosin,"),
      p("Thanks again for getting everything set up and for the thorough handoff documentation."),
      p("I've started working through the sandbox and everything looks great so far."),
      p("At this point, I'm onboarding with Spinwheel and working through their production readiness process so we can obtain our live credentials."),
      p("As soon as those credentials are available, I'd like to move forward with implementing the production configuration and preparing for launch. I'll keep you posted as I receive updates from Spinwheel."),
      p("Thanks again for all your work on this!"),
    ],
  },
  {
    id: "msg_f8a9b0c1d2e7b8c9",
    conversationId: CONV,
    authorId: "chelsea",
    createdAt: "2026-06-29T10:16:00Z",
    body: [{ b: "p", children: [{ t: "mention", personId: "tosin" }] }],
  },
  {
    id: "msg_a9b0c1d2e3f8c9d0",
    conversationId: CONV,
    authorId: "tosin",
    createdAt: "2026-07-04T09:00:00Z",
    body: [p("Okay thank you!")],
  },
];

const FOLDER = "fo_c907da8493d24cca985038f9";

export const BOARDS: Board[] = [
  {
    id: "brd_9f2c4a71e08d",
    name: "CardFlow — Path to Production",
    folderId: FOLDER,
    columns: [
      {
        id: "col_done",
        name: "Done",
        cards: [
          {
            id: "crd_1",
            title: "Milestone 2 — Plaid bank linking",
            assigneeId: "tosin",
            labels: ["milestone"],
          },
          {
            id: "crd_2",
            title: "Milestone 3 — Spinwheel split payments",
            assigneeId: "tosin",
            labels: ["milestone"],
          },
          {
            id: "crd_3",
            title: "Sandbox handoff doc + walkthrough video",
            description: "SANDBOX_HANDOFF.pdf shared 26 Jun",
            assigneeId: "tosin",
          },
        ],
      },
      {
        id: "col_progress",
        name: "In Progress",
        cards: [
          {
            id: "crd_4",
            title: "Webhook auth — custom headers + IP allowlist",
            description:
              "Spinwheel has no shared secret; verify custom headers and allowlist the five sandbox/prod IPs.",
            assigneeId: "tosin",
            dueDate: "2026-08-01",
            labels: ["security"],
          },
          {
            id: "crd_5",
            title: "End-to-end sandbox testing",
            assigneeId: "chelsea",
            dueDate: "2026-08-05",
          },
        ],
      },
      {
        id: "col_blocked",
        name: "Blocked",
        cards: [
          {
            id: "crd_6",
            title: "Spinwheel production credentials",
            description:
              "Blocked on Spinwheel's production readiness review. Chelsea is onboarding.",
            assigneeId: "chelsea",
            labels: ["blocker"],
          },
        ],
      },
      {
        id: "col_todo",
        name: "To Do",
        cards: [
          {
            id: "crd_7",
            title: "Production environment configuration",
            assigneeId: "tosin",
            labels: ["launch"],
          },
          {
            id: "crd_8",
            title: "Compliance review with Spinwheel",
            assigneeId: "chelsea",
            labels: ["launch"],
          },
          {
            id: "crd_9",
            title: "Go-live checklist sign-off",
            assigneeId: "brooks",
            labels: ["launch"],
          },
        ],
      },
    ],
  },
];

export const DOCUMENTS: KDocument[] = [
  {
    id: "doc_4b71ca9e2f30",
    name: "Spinwheel webhook configuration",
    folderId: FOLDER,
    authorId: "chelsea",
    updatedAt: "2026-06-15T09:30:00Z",
    blocks: [
      p("Spinwheel does not issue a platform-generated webhook secret the way Stripe does. Webhook security is handled through custom authentication headers combined with IP whitelisting."),
      { b: "p", children: [{ t: "text", v: "How it works", bold: true }] },
      ul([
          [{ t: "text", v: "Webhooks are created through the Spinwheel dashboard or API." }],
          [{ t: "text", v: "The partner configures custom authentication headers at creation time." }],
          [{ t: "text", v: "Spinwheel includes those headers on every webhook POST request." }],
          [{ t: "text", v: "Your endpoint verifies the headers and rejects anything from an unlisted IP." }],
      ]),
      { b: "p", children: [{ t: "text", v: "Sandbox IPs", bold: true }] },
      {
        b: "code",
        v: "34.203.72.127\n52.2.114.95\n52.12.60.65",
      },
      { b: "p", children: [{ t: "text", v: "Production IPs", bold: true }] },
      { b: "code", v: "44.232.30.137\n3.230.55.249" },
      { b: "p", children: [{ t: "text", v: "Updating headers", bold: true }] },
      {
        b: "code",
        lang: "javascript",
        v: "await fetch(\n  `${BASE}/v1/partners/webhooks/${webhookId}/headers`,\n  { method: 'PATCH', headers: { accept: 'application/json' } }\n);",
      },
      {
        b: "p",
        children: [
          { t: "text", v: "Reference: " },
          { t: "link", href: "https://docs.spinwheel.io/docs/webhooks" },
        ],
      },
    ],
  },
];

export const EMBEDS: Embed[] = [
  {
    id: "emb_7c15de8a03b2",
    name: "Sandbox app",
    folderId: FOLDER,
    url: "https://frontend-sandbox-mu.vercel.app",
    provider: "Vercel",
  },
];

export const COMPANIES: Company[] = [
  {
    id: "cmp_cardflow",
    name: "CardFlow Financial",
    domain: "cardflowfinancial.com",
    clientIds: ["chelsea"],
    createdAt: "2026-03-26",
  },
];

export const TEMPLATES: Template[] = [
  {
    id: "tpl_client_project",
    name: "Client Project",
    description: "Kickoff conversation, delivery board, and a shared files area.",
    contents: ["Conversation", "Board", "Files"],
  },
  {
    id: "tpl_onboarding",
    name: "Client Onboarding",
    description: "Everything a new client needs to sign, share, and get started.",
    contents: ["Document", "Conversation", "Files"],
  },
  {
    id: "tpl_launch",
    name: "Launch Checklist",
    description: "Path-to-production board with compliance and go-live columns.",
    contents: ["Board", "Document"],
  },
  {
    id: "tpl_retainer",
    name: "Monthly Retainer",
    description: "Recurring reporting doc, an embed for dashboards, and a thread.",
    contents: ["Document", "Embed", "Conversation"],
  },
];

export const TASKS: Task[] = [
  {
    id: "tsk_1",
    title: "Verify webhook custom auth headers end to end",
    status: "in_progress",
    dueDate: "2026-08-01",
    assigneeId: "tosin",
    folderId: FOLDER,
    completed: false,
  },
  {
    id: "tsk_2",
    title: "Allowlist Spinwheel sandbox + production IPs",
    status: "todo",
    dueDate: "2026-08-01",
    assigneeId: "tosin",
    folderId: FOLDER,
    completed: false,
  },
  {
    id: "tsk_3",
    title: "Complete Spinwheel production readiness review",
    status: "in_progress",
    dueDate: "2026-08-12",
    assigneeId: "chelsea",
    folderId: FOLDER,
    completed: false,
  },
  {
    id: "tsk_4",
    title: "Run sandbox validation scenarios",
    status: "todo",
    dueDate: "2026-08-05",
    assigneeId: "chelsea",
    folderId: FOLDER,
    completed: false,
  },
  {
    id: "tsk_5",
    title: "Production environment configuration",
    status: "todo",
    dueDate: "2026-08-20",
    assigneeId: "tosin",
    folderId: FOLDER,
    completed: false,
  },
  {
    id: "tsk_6",
    title: "Go-live checklist sign-off",
    status: "todo",
    dueDate: "2026-08-28",
    assigneeId: "brooks",
    folderId: FOLDER,
    completed: false,
  },
  {
    id: "tsk_7",
    title: "Share sandbox URL and test credentials",
    status: "done",
    dueDate: "2026-06-26",
    assigneeId: "tosin",
    folderId: FOLDER,
    completed: true,
  },
  {
    id: "tsk_8",
    title: "Record full system walkthrough",
    status: "done",
    dueDate: "2026-06-23",
    assigneeId: "tosin",
    folderId: FOLDER,
    completed: true,
  },
];

export const INBOX: InboxEntry[] = [
  {
    id: "in_1",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-29T10:16:00Z",
    system: true,
    preview: 'Mentioned you in conversation "CardFlow - Chelsea / Brooks / Tosin"',
    breadcrumb: ["Home", "CardFlowFinancial"],
    href: `/conversations/${CONV}#msg_f8a9b0c1d2e7b8c9`,
  },
  {
    id: "in_2",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-29T10:15:00Z",
    preview:
      "Hi Tosin, Thanks again for getting everything set up and for the thorough handoff documentation. I've started working throug…",
    breadcrumb: ["CardFlowFinancial", "CardFlow - Chelsea / Brooks / Tosin"],
    href: `/conversations/${CONV}#msg_e7f8a9b0c1d6a7b8`,
  },
  {
    id: "in_3",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-23T16:20:00Z",
    system: true,
    preview: 'Mentioned you in conversation "CardFlow - Chelsea / Brooks / Tosin"',
    breadcrumb: ["Home", "CardFlowFinancial"],
    href: `/conversations/${CONV}#msg_c5d6e7f8a9b4e5f6`,
  },
  {
    id: "in_4",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-15T09:30:00Z",
    system: true,
    preview: 'Mentioned you in conversation "CardFlow - Chelsea / Brooks / Tosin"',
    breadcrumb: ["Home", "CardFlowFinancial"],
    href: `/conversations/${CONV}#msg_f2a3b4c5d6e1b2c3`,
  },
  {
    id: "in_5",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-10T18:45:00Z",
    preview:
      "Hey Tosin, I spent some time digging through the Spinwheel documentation regarding the webhook configuration. From…",
    breadcrumb: ["CardFlowFinancial", "CardFlow - Chelsea / Brooks / Tosin"],
    href: `/conversations/${CONV}#msg_e1f2a3b4c5d0a1b2`,
  },
  {
    id: "in_6",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-10T15:03:00Z",
    system: true,
    preview: 'Mentioned you in conversation "CardFlow - Chelsea / Brooks / Tosin"',
    breadcrumb: ["Home", "CardFlowFinancial"],
    href: `/conversations/${CONV}#msg_c9d0e1f2a3b8ef90`,
  },
  {
    id: "in_7",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-10T15:02:00Z",
    preview:
      "Hey Tosin, Yes, that flow matches my vision for CardFlow, perfectly! Thank you for the update on Milestones 2 and 3. I…",
    breadcrumb: ["CardFlowFinancial", "CardFlow - Chelsea / Brooks / Tosin"],
    href: `/conversations/${CONV}#msg_264c27d9c13da38a5653b05e`,
  },
  {
    id: "in_8",
    kind: "chat",
    authorId: "chelsea",
    createdAt: "2026-06-05T08:44:00Z",
    preview:
      "Hey guys, do you mind sharing the updated timelines for Phases 2 and 3? I'm working through some planning and timeline…",
    breadcrumb: ["CardFlowFinancial", "CardFlow - Chelsea / Brooks / Tosin"],
    href: `/conversations/${CONV}#msg_f6a7b8c9d0e5bc6d`,
  },
];
