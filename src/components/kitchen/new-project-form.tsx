"use client";

import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import {
  createFolderAction,
  createOrganizationAction,
} from "@/app/(workspace)/actions";
import { dialogFieldClass } from "@/components/kitchen/dialog-shell";

const textareaClassName = `${dialogFieldClass} h-auto resize-none py-2`;

function FieldRow({
  label,
  htmlFor,
  caption,
  children,
}: {
  label: string;
  htmlFor: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 border-k-black-06 border-b px-6 py-6 last:border-b-0 md:grid-cols-[200px_1fr] md:gap-8 md:px-8">
      <label htmlFor={htmlFor} className="font-medium text-k-black-84 text-md">
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {caption ? <p className="mt-2 text-k-black-40 text-sm">{caption}</p> : null}
      </div>
    </div>
  );
}

export function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(name.trim());

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        const organization = await createOrganizationAction(
          name.trim(),
          domain.trim() || undefined,
        );
        await createFolderAction({
          name: name.trim(),
          description: description.trim() || undefined,
          organizationId: organization.id,
        });
        router.push(`/w/${organization.slug}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      }
    });
  };

  return (
    <>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-k-black-40 text-md transition-colors hover:text-k-black-84"
      >
        <ArrowLeftIcon className="size-4" strokeWidth={1.8} aria-hidden="true" />
        Back to dashboard
      </Link>

      <form
        onSubmit={onSubmit}
        className="overflow-hidden rounded-lg border border-k-black-08 bg-background"
      >
        <div className="border-k-black-06 border-b px-6 py-6 md:px-8">
          <h1 className="font-semibold text-k-black-84 text-title">New project</h1>
          <p className="mt-1 text-k-black-40 text-md">
            Creates a project and its first workspace folder. You can add clients
            and more folders after.
          </p>
        </div>

        <FieldRow
          label="Title"
          htmlFor="project-name"
          caption="The project's name — also becomes the first folder's name."
        >
          <input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc."
            autoFocus
            disabled={pending}
            className={dialogFieldClass}
          />
        </FieldRow>

        <FieldRow label="Domain" htmlFor="project-domain" caption="Optional.">
          <input
            id="project-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="acme.com"
            disabled={pending}
            className={dialogFieldClass}
          />
        </FieldRow>

        <FieldRow label="Description" htmlFor="project-description" caption="Optional.">
          <textarea
            id="project-description"
            className={textareaClassName}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this engagement about?"
            disabled={pending}
          />
        </FieldRow>

        {error ? (
          <div className="border-k-black-06 border-b px-6 py-4 md:px-8">
            <p role="alert" className="text-k-red text-md">
              {error}
            </p>
          </div>
        ) : null}

        <div className="flex items-center justify-between px-6 py-5 md:px-8">
          <Link
            href="/"
            className="flex h-9 items-center rounded-lg px-3.5 text-k-black-56 text-md transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit || pending}
            className="flex h-9 items-center gap-2 rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                Creating…
              </>
            ) : (
              "Create project"
            )}
          </button>
        </div>
      </form>
    </>
  );
}
