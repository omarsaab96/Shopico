import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

export function OrderDragCard({ id, disabled, label, children, colorCode }: { id: string; disabled: boolean; label: string; children: ReactNode; colorCode: string }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id, disabled });
  const node = useRef<HTMLElement | null>(null);
  const previousTop = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!node.current) return;
    const top = node.current.getBoundingClientRect().top;
    if (previousTop.current !== null && previousTop.current !== top && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.current.animate([{ transform: `translateY(${previousTop.current - top}px)` }, { transform: "translateY(0)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
    previousTop.current = top;
  });
  return (
    <article ref={element => { node.current = element; setNodeRef(element); }} className={`orders-basket-card ${colorCode.toLowerCase()} ${isDragging ? " orders-card-dragging" : ""}`}>
      {!disabled &&
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={`orders-drag-handle ${colorCode.toLowerCase()}`} {...attributes} {...listeners}
          aria-label={label}
        >
          {/* <span aria-hidden="true">⠿</span> */}
        </button>
      }
      {children}
    </article>
  );
}

export function OrderDropBasket({ status, disabled, label, children }: { status: string; disabled: boolean; label: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled, data: { status } });
  return <section ref={setNodeRef} className={`orders-basket ${status.toLowerCase()} ${isOver ? " orders-basket-over" : ""}`} aria-label={label} data-status={status}>{children}</section>;
}
