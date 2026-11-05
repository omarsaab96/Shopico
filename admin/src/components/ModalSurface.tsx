import { useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

// The inner surface keeps its natural size while the outer viewport animates to it.
export function ModalContent({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const inner = content.current;
    const surface = inner?.parentElement;
    if (!inner || !surface) return;
    const measure = () => {
      const bounds = inner.getBoundingClientRect();
      if (!bounds.width && !bounds.height) return;
      const style = getComputedStyle(surface);
      const gutter = surface.offsetWidth - surface.clientWidth;
      surface.style.width = `${Math.min(Math.ceil(bounds.width + gutter), window.innerWidth - 32)}px`;
      surface.style.height = `${Math.min(Math.ceil(bounds.height + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)), window.innerHeight - 32)}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return <div ref={content} className="modal-content">{children}</div>;
}

export default function ModalSurface({ children, className = "modal", style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const dimensions = { ...style, width: undefined,
    ...(style?.width ? { "--modal-max-width": typeof style.width === "number" ? `${style.width}px` : style.width.replaceAll("100%", "100vw") } : {}),
  } as CSSProperties;
  return <div role="dialog" aria-modal="true" {...props} className={className} style={dimensions}>
    <ModalContent>{children}</ModalContent>
  </div>;
}
