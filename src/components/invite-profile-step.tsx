"use client";

/**
 * Client onboarding, step two: confirm the name an admin typed in when they
 * created this Person, and optionally add a photo. Mirrors the upload shape
 * `folder-cover-button.tsx` uses — bytes go straight to Storage from the
 * browser, then a server action records the resulting URL — against the
 * `people/{personId}` Storage prefix (see storage.rules).
 */
import { useRef, useState } from "react";
import { motion, type Variants } from "motion/react";
import { CameraIcon, Loader2Icon } from "lucide-react";
import { updatePersonProfileAction } from "@/app/(workspace)/actions";
import { uploadFile } from "@/lib/firebase/storage";
import { unsupportedImageReason } from "@/lib/kitchen-format";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 340, damping: 28 },
  },
};

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileStep({
  personId,
  organizationSlug,
  initialName,
}: {
  personId: string;
  organizationSlug: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const reason = unsupportedImageReason(file);
    if (reason) {
      setError(reason);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile(`people/${personId}`, file);
      setAvatarUrl(result.downloadUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const finish = async () => {
    setPending(true);
    setError(null);
    try {
      await updatePersonProfileAction(personId, {
        name: name.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
      });
      window.location.replace(`/w/${organizationSlug}`);
    } catch {
      setError("Couldn't save that. Try again.");
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background px-6 text-foreground">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm"
      >
        <motion.div variants={itemVariants} className="mb-7">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            You&apos;re in — one more thing
          </h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Confirm your name and add a photo so your team knows it&apos;s you.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="mb-6 flex justify-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label="Add a photo"
            className="group relative flex size-20 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-muted-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <span>{initialsFrom(name || "?")}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? (
                <Loader2Icon className="size-5 animate-spin text-white" />
              ) : (
                <CameraIcon className="size-5 text-white" />
              )}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Field>
            <FieldLabel htmlFor="profile-name">Name</FieldLabel>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
              nativeInput
            />
          </Field>
        </motion.div>

        {error ? (
          <p role="alert" className="mt-3 text-destructive text-xs">
            {error}
          </p>
        ) : null}

        <motion.div variants={itemVariants} className="mt-6">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={pending || uploading || !name.trim()}
            onClick={finish}
          >
            {pending ? (
              <>
                <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                Finishing…
              </>
            ) : (
              "Go to workspace"
            )}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
