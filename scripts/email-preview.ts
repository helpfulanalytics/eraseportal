/**
 * Writes the template gallery to a file, for looking at the emails without
 * running the dev server: `npm run email:preview`.
 */
import { writeFileSync } from "node:fs";
import { previewGallery } from "../src/lib/email/preview";

const out = process.argv[2] ?? "email-preview.html";
writeFileSync(out, previewGallery(), "utf8");
console.log(`Wrote ${out}`);
