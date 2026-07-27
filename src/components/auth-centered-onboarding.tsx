"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardPanel } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = ["Workspace", "Invite", "Ready"] as const;

export function AuthCenteredOnboardingShowcasePage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4 py-12 text-foreground">
      <PageBackdrop />
      <div className="relative w-full max-w-sm">
        <Card className="p-7">
          <CardHeader className="flex flex-col items-center gap-4 p-0 text-center">
            <BrandMark />
          </CardHeader>
          <CardPanel className="mt-2 flex flex-col gap-0 p-0">
            <OnboardingFlow />
          </CardPanel>
        </Card>
      </div>
    </div>
  );
}

function PageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background: [
          "radial-gradient(50% 40% at 0% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)",
          "radial-gradient(55% 45% at 100% 100%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%)",
        ].join(", "),
      }}
    />
  );
}

function BrandMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      className="size-9"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <circle
        cx="20"
        cy="20"
        r="17"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <rect x="11" y="11" width="18" height="18" rx="3" fill="currentColor" />
      <path
        d="M16 22.5c.6.7 1.7 1.2 2.9 1.2 1.5 0 2.6-.7 2.6-1.8 0-1-.7-1.5-2.2-1.8l-.9-.2c-.9-.2-1.3-.5-1.3-1 0-.6.6-1 1.4-1 .9 0 1.5.4 1.7 1l1.4-.5c-.3-1.1-1.4-1.8-3-1.8-1.6 0-2.7.8-2.7 2 0 1 .7 1.6 2.1 1.9l.9.2c.9.2 1.4.5 1.4 1.1 0 .6-.6 1-1.5 1-1 0-1.7-.4-2-1.1l-1.5.6Z"
        fill="var(--background)"
      />
    </svg>
  );
}

function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState("");
  const [invitees, setInvitees] = useState<string[]>([]);
  const [pendingEmail, setPendingEmail] = useState("");

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div>
      <Stepper step={step} />

      {step === 0 ? (
        <WorkspaceStep
          value={workspace}
          onChange={setWorkspace}
          onSubmit={(e) => {
            e.preventDefault();
            if (!workspace.trim()) return;
            next();
          }}
        />
      ) : null}

      {step === 1 ? (
        <InviteStep
          invitees={invitees}
          pending={pendingEmail}
          onPendingChange={setPendingEmail}
          onAdd={(e) => {
            e.preventDefault();
            const trimmed = pendingEmail.trim().toLowerCase();
            if (!trimmed) return;
            if (invitees.includes(trimmed)) {
              setPendingEmail("");
              return;
            }
            setInvitees((prev) => [...prev, trimmed]);
            setPendingEmail("");
          }}
          onRemove={(email) =>
            setInvitees((prev) => prev.filter((e) => e !== email))
          }
          onContinue={next}
          onBack={back}
        />
      ) : null}

      {step === 2 ? (
        <ReadyStep
          workspace={workspace || "Untitled"}
          count={invitees.length}
          // Was "/app", which has never been a route in this app — finishing
          // onboarding 404'd. The workspace lives at "/".
          onFinish={() => window.location.assign("/")}
        />
      ) : null}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
      <span>
        Step {String(step + 1).padStart(2, "0")} / {STEPS.length}
      </span>
      <div className="ml-2 flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step
                ? "w-5 bg-foreground"
                : i < step
                  ? "w-1.5 bg-foreground/70"
                  : "w-1.5 bg-foreground/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceStep({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="text-center">
      <h1 className="mt-5 font-heading text-2xl tracking-tight">
        What are we calling it?
      </h1>
      <p className="mt-1.5 text-muted-foreground text-sm">
        You can change this later in settings.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4 text-left">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onboarding-workspace">Workspace name</Label>
          <Input
            id="onboarding-workspace"
            placeholder="Acme inc."
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            nativeInput
          />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={!value.trim()}
          className="mt-1 w-full"
        >
          Continue
        </Button>
      </form>
    </div>
  );
}

function InviteStep({
  invitees,
  pending,
  onPendingChange,
  onAdd,
  onRemove,
  onContinue,
  onBack,
}: {
  invitees: string[];
  pending: string;
  onPendingChange: (v: string) => void;
  onAdd: (e: FormEvent) => void;
  onRemove: (email: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="text-center">
      <h1 className="mt-5 font-heading text-2xl tracking-tight">
        Invite teammates
      </h1>
      <p className="mt-1.5 text-muted-foreground text-sm">
        Optional — you can add anyone later.
      </p>

      <form onSubmit={onAdd} className="mt-6 flex gap-2 text-left">
        <Input
          type="email"
          placeholder="colleague@example.com"
          autoComplete="off"
          value={pending}
          onChange={(e) => onPendingChange(e.target.value)}
          nativeInput
        />
        <Button type="submit" variant="outline">
          Add
        </Button>
      </form>

      {invitees.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5 text-left">
          {invitees.map((email) => (
            <li
              key={email}
              className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="truncate text-foreground/85">{email}</span>
              <button
                type="button"
                onClick={() => onRemove(email)}
                className="cursor-pointer font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] transition-colors hover:text-foreground"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-muted-foreground text-xs">
          No invites yet. Add a few or skip — totally fine.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost" type="button" onClick={onBack}>
          Back
        </Button>
        <Button type="button" size="lg" onClick={onContinue}>
          {invitees.length === 0
            ? "Skip for now"
            : `Send ${invitees.length} invite${invitees.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

function ReadyStep({
  workspace,
  count,
  onFinish,
}: {
  workspace: string;
  count: number;
  onFinish: () => void;
}) {
  return (
    <div className="text-center">
      <h1 className="mt-5 font-heading text-2xl tracking-tight">
        Welcome to {workspace}.
      </h1>
      <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
        {count === 0
          ? "Quiet for now — when you're ready, invite people from settings."
          : `We've sent ${count} invite${count === 1 ? "" : "s"}. They'll show up here once accepted.`}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 text-left">
        <FactCard label="Workspace" value={workspace} />
        <FactCard label="Members" value={String(count + 1)} />
        <FactCard label="Plan" value="Free" />
      </div>

      <Button size="lg" className="mt-6 w-full" type="button" onClick={onFinish}>
        Take me in
      </Button>
    </div>
  );
}

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-3">
      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">
        {label}
      </div>
      <div className="mt-1 truncate font-heading text-sm">{value}</div>
    </div>
  );
}
