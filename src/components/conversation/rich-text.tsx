"use client";

import { usePeople } from "@/components/workspace-provider";
import type { Block, Inline } from "@/lib/kitchen-types";

/** Renders a structured message body. See the Block/Inline types in kitchen-data. */
export function RichText({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, i) => {
        const key = `${block.b}-${i}`;
        if (block.b === "p") {
          return (
            <p key={key} className="text-k-black-84 text-md">
              <InlineRun nodes={block.children} />
            </p>
          );
        }
        if (block.b === "ul") {
          return (
            <ul key={key} className="flex flex-col gap-1 pl-1">
              {block.items.map((item, j) => (
                <li
                  key={`${key}-${j}`}
                  className="flex gap-2 text-k-black-84 text-md"
                >
                  <span aria-hidden="true" className="text-k-black-40">
                    •
                  </span>
                  <span>
                    <InlineRun nodes={item.children} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <pre
            key={key}
            className="overflow-x-auto rounded-lg bg-k-black-04 p-3 font-mono text-k-black-84 text-sm"
          >
            <code>{block.v}</code>
          </pre>
        );
      })}
    </div>
  );
}

function InlineRun({ nodes }: { nodes: Inline[] }) {
  const people = usePeople();

  return (
    <>
      {nodes.map((node, i) => {
        const key = `${node.t}-${i}`;

        if (node.t === "mention") {
          const person = people[node.personId];
          return (
            <span
              key={key}
              className="rounded bg-k-blue-08 px-1 py-px font-medium text-k-blue"
            >
              @{person?.handle ?? "unknown"}
            </span>
          );
        }

        if (node.t === "link") {
          return (
            <a
              key={key}
              href={node.href}
              className="text-k-blue hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {node.v ?? node.href}
            </a>
          );
        }

        if (node.bold) {
          return (
            <strong key={key} className="font-semibold">
              {node.v}
            </strong>
          );
        }
        if (node.italic) {
          return <em key={key}>{node.v}</em>;
        }
        return <span key={key}>{node.v}</span>;
      })}
    </>
  );
}
