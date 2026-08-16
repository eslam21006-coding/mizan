type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M16 5v20M8 9h16M10 9l-4 7h8l-4-7ZM22 9l-4 7h8l-4-7ZM11 25h10" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>ميزان</strong>
        {!compact && <small>Mizan</small>}
      </span>
    </div>
  );
}
