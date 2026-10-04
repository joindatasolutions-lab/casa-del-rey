export default function BaseChart({ ariaLabel, children, className = "", height = 220 }) {
  return (
    <div className={`chart-frame ${className}`} role="img" aria-label={ariaLabel} style={{ height }}>
      {children}
    </div>
  );
}
