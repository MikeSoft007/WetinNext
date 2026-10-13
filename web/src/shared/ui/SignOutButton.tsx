import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
export default function SignOutButton({
  onConfirm,
  disabled = false,
}: {
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cancel = useRef<HTMLButtonElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    wasOpen = useRef(false);
  useEffect(() => {
    if (open) cancel.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        className="workspace-signout"
        disabled={disabled}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        <LogOut size={15} /> Sign out
      </button>
      {open && (
        <div className="modal-backdrop">
          <section
            className="modal logout-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            aria-describedby="logout-description"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !busy) setOpen(false);
              if (e.key === "Tab") {
                const buttons = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                );
                if (e.shiftKey && document.activeElement === buttons[0]) {
                  e.preventDefault();
                  buttons.at(-1)?.focus();
                } else if (
                  !e.shiftKey &&
                  document.activeElement === buttons.at(-1)
                ) {
                  e.preventDefault();
                  buttons[0]?.focus();
                }
              }
            }}
          >
            <h2 id="logout-title">Sign out of WetinNext?</h2>
            <p id="logout-description">
              Your saved learning progress and preparation will be kept.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="logout-actions">
              <button
                ref={cancel}
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Stay signed in
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void confirm()}
              >
                {busy ? "Signing out…" : "Yes, sign out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
