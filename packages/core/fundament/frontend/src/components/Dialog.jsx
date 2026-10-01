import { createPortal } from "react-dom";

export default function Dialog({ open, title, children, actions, onClose, wide = false }) {
  if (!open) return null;

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className={wide ? "dialog dialog-wide" : "dialog"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h3 className="dialog-title">{title}</h3>}
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}
