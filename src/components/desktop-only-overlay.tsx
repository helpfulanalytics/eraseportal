import { MonitorIcon } from "lucide-react";

export function DesktopOnlyOverlay() {
  return (
    <div className="md:hidden fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-8 text-center text-k-black">
      <div className="mb-6 rounded-full bg-k-black-04 p-6 text-k-black-40">
        <MonitorIcon className="size-10" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-xl font-semibold tracking-tight">
        Desktop Environment Only
      </h2>
      <p className="text-md text-k-black-40 max-w-sm">
        The Erase Friction Portal is designed for larger screens. Please maximize
        your window or switch to a desktop device to continue.
      </p>
    </div>
  );
}
