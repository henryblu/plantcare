interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const Toast = ({ message, actionLabel, onAction, onDismiss }: ToastProps) => (
  <div className="toast" role="status">
    <span className="toast__message">{message}</span>
    <div className="toast__actions">
      {actionLabel && onAction && (
        <button type="button" className="toast__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button type="button" className="toast__dismiss" onClick={onDismiss} aria-label="Dismiss notification">
          ×
        </button>
      )}
    </div>
  </div>
);

export default Toast;
