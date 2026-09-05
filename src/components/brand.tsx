type BrandProps = {
  compact?: boolean;
};

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"} data-testid="mizan-brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" role="img">
          <path
            className="mizan-mark-left"
            d="M7 12.5c0-3.4 3.8-5.4 6.6-3.4l13.1 9.2c1.4 1 2.3 2.6 2.3 4.3V52c0 2.2-1.8 4-4 4H11c-2.2 0-4-1.8-4-4V12.5Z"
          />
          <circle className="mizan-mark-dot" cx="35" cy="36" r="6.5" />
          <path
            className="mizan-mark-right"
            d="M41 26.2c0-1.7.9-3.3 2.3-4.3l10.1-7.1c2.8-2 6.6 0 6.6 3.4V52c0 2.2-1.8 4-4 4H45c-2.2 0-4-1.8-4-4V26.2Z"
          />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>ميزان</strong>
        {!compact && <small>MIZAN</small>}
      </span>
    </div>
  );
}
