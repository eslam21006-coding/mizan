"use client";

import { useEffect, useId, useState } from "react";
import { AppNavigation } from "./app-navigation";
import styles from "./app-shell.module.css";
import { Brand } from "./brand";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const drawerId = useId();

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

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.body.classList.add("mobile-menu-open");
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.classList.remove("mobile-menu-open");
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <div className="app-frame">
      <aside className={`sidebar desktop-sidebar ${styles.scrollableSidebar}`}>
        <div className="sidebar-header">
          <Brand />
        </div>
        <AppNavigation />
        <div className="sidebar-footer">
          <div className="foundation-note">
            <span className="foundation-dot" />
            <div>
              <strong>نسخة تأسيسية</strong>
              <small>هيكل التطبيق فقط</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-topbar">
          <Brand compact />
          <button
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
        className={isMenuOpen ? "mobile-drawer-layer mobile-drawer-layer-open" : "mobile-drawer-layer"}
      >
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="إغلاق القائمة"
          tabIndex={isMenuOpen ? 0 : -1}
          onClick={() => setIsMenuOpen(false)}
        />
        <aside
          id={drawerId}
          className="mobile-drawer"
          aria-label="التنقل الرئيسي للموبايل"
          aria-hidden={!isMenuOpen}
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
          <AppNavigation onNavigate={() => setIsMenuOpen(false)} />
        </aside>
      </div>
    </div>
  );
}
