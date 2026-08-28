import type { KeyboardEvent, PointerEvent } from "react";

type PanelSplitterProps = {
  label: string;
  onResizeStart: (clientX: number) => void;
  onResize: (clientX: number) => void;
  onResizeEnd: () => void;
  onKeyboardResize: (delta: number) => void;
  onReset: () => void;
};

export function PanelSplitter({
  label,
  onResizeStart,
  onResize,
  onResizeEnd,
  onKeyboardResize,
  onReset,
}: PanelSplitterProps) {
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onResizeStart(event.clientX);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    onResize(event.clientX);
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onResizeEnd();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onKeyboardResize(event.key === "ArrowLeft" ? -16 : 16);
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      tabIndex={0}
      className="group relative flex h-full touch-none select-none items-center justify-center outline-none"
      style={{ cursor: "col-resize" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    >
      <div
        className="h-full w-px transition-colors group-hover:w-0.5 group-focus:w-0.5"
        style={{ background: "var(--border)" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        style={{ background: "var(--accent-dim)" }}
      />
    </div>
  );
}
