import type { NavigationIcon } from "@/lib/navigation";

type NavIconProps = {
  name: NavigationIcon;
};

export function NavIcon({ name }: NavIconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <path d="M3.5 10.5 12 3.7l8.5 6.8" />
        <path d="M5.5 9.8v10.4h13V9.8" />
        <path d="M9.4 20.2v-6.1h5.2v6.1" />
      </svg>
    );
  }

  if (name === "business") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <rect x="3.5" y="7" width="17" height="13" rx="2.2" />
        <path d="M8.2 7V5.2c0-.9.7-1.7 1.7-1.7h4.2c.9 0 1.7.7 1.7 1.7V7" />
        <path d="M3.5 12.2c3.5 1.4 13.5 1.4 17 0M10.2 12v2h3.6v-2" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <rect x="3.5" y="5.4" width="17" height="15" rx="2.3" />
        <path d="M7.6 3.5v4M16.4 3.5v4M3.5 9.4h17" />
        <path d="M8 13h2M14 13h2M8 16.7h2M14 16.7h2" />
      </svg>
    );
  }

  if (name === "customers") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <circle cx="9" cy="8.1" r="3.1" />
        <path d="M3.8 19.5c.4-3.5 2.1-5.3 5.2-5.3s4.8 1.8 5.2 5.3" />
        <path d="M15.5 5.7a2.8 2.8 0 0 1 0 5.4M16.2 14.4c2.5.4 3.7 2.1 4 5.1" />
      </svg>
    );
  }

  if (name === "funnel") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <path d="M3.5 5h17l-6.6 7.3v5.2l-3.8 2.1v-7.3L3.5 5Z" />
      </svg>
    );
  }

  if (name === "simulator") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <path d="M4 7.2h16M4 16.8h16" />
        <circle cx="9" cy="7.2" r="2.1" />
        <circle cx="15" cy="16.8" r="2.1" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <circle cx="11" cy="13" r="7.4" />
        <circle cx="11" cy="13" r="3.4" />
        <path d="m13.5 10.5 6.4-6.4M16.4 4.1h3.5v3.5" />
      </svg>
    );
  }

  if (name === "analytics") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
        <path d="M4 20V10.8M10 20V4M16 20v-6.4M22 20H2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.2 13.8a7.7 7.7 0 0 0 0-3.6l2-1.5-2-3.4-2.5 1a8.1 8.1 0 0 0-3.1-1.8L13.2 2H9.3l-.4 2.5a8.1 8.1 0 0 0-3.1 1.8l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3.6l-2 1.5 2 3.4 2.4-1a8.1 8.1 0 0 0 3.1 1.8l.4 2.5h3.9l.4-2.5a8.1 8.1 0 0 0 3.1-1.8l2.5 1 2-3.4-2-1.5Z" />
    </svg>
  );
}
