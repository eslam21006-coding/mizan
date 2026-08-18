"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MizanRole } from "@/lib/auth/role";
import { AppNavigation } from "./app-navigation";
import styles from "./app-shell.module.css";
import { Brand } from "./brand";

type AppShellProps = {
  children: React.ReactNode;
  role: MizanRole;
  email: string | null;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function AccountPanel({ role, email }: { role: MizanRole; email: string | null }) {
  return (
    <div className={styles.accountPanel}>
      <div className={styles.accountCopy}>
        <strong>{role === "admin" ? "Admin" : "Mentee"}</strong>
        <small title={email ?? undefined}>{email ?? "حساب ميزان"}</small>
      </div>
      <form action="/auth/signout" method="post">
        <button className={styles.signOutButton} type="submit">
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}

export function AppShell({ children, role, email }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const drawerId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const appMainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mobileViewport = window.matchMedia("(max-width: 900px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setIsMenuOpen(false);
      }
    };

    mobileViewport.addEventListener("change", handleViewportChange);
    return () => mobileViewport.removeEventListener("change", handleViewportChange);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const drawer = drawerRef.current;
    const appMain = appMainRef.current;
    if (!drawer) {
      return;
    }

    const getFocusableElements = () =>
      Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) =>
          !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
      );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutsideDrawer = !activeElement || !drawer.contains(activeElement);

      if (event.shiftKey && (activeElement === firstElement || focusIsOutsideDrawer)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || focusIsOutsideDrawer)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.classList.add("mobile-menu-open");
    if (appMain) {
      appMain.inert = true;
    }
    document.addEventListener("keydown", handleKeyDown);

    getFocusableElements()[0]?.focus();

    return () => {
      document.body.classList.remove("mobile-menu-open");
      if (appMain) {
        appMain.inert = false;
      }
      document.removeEventListener("keydown", handleKeyDown);

      if (window.matchMedia("(max-width: 900px)").matches) {
        menuButtonRef.current?.focus();
      }
    };
  }, [isMenuOpen]);

  return (
    <div className="app-frame">
      <aside className={`sidebar desktop-sidebar ${styles.scrollableSidebar}`}>
        <div className="sidebar-header">
          <Brand />
        </div>
        <AppNavigation role={role} />
        <div className="sidebar-footer">
          <AccountPanel role={role} email={email} />
        </div>
      </aside>

      <div className="app-main" ref={appMainRef}>
        <header className="mobile-topbar">
          <Brand compact />
          <button
            ref={menuButtonRef}
            type="button"
            className="menu-button"
            aria-label="فتح القائمة"
            aria-controls={drawerId}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        <main className="page-content">{children}</main>
      </div>

      <div
        className={
          isMenuOpen ? "mobile-drawer-layer mobile-drawer-layer-open" : "mobile-drawer-layer"
        }
      >
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="إغلاق القائمة"
          tabIndex={-1}
          onClick={() => setIsMenuOpen(false)}
        />
        <aside
          ref={drawerRef}
          id={drawerId}
          className="mobile-drawer"
          role="dialog"
          aria-modal={isMenuOpen ? "true" : undefined}
          aria-label="التنقل الرئيسي للموبايل"
          aria-hidden={!isMenuOpen}
          tabIndex={-1}
        >
          <div className="drawer-header">
            <Brand />
            <button
              type="button"
              className="close-button"
              aria-label="إغلاق القائمة"
              onClick={() => setIsMenuOpen(false)}
            >
              ×
            </button>
          </div>
          <AppNavigation role={role} onNavigate={() => setIsMenuOpen(false)} />
          <div className={styles.mobileAccountPanel}>
            <AccountPanel role={role} email={email} />
          </div>
        </aside>
      </div>
    </div>
  );
}
