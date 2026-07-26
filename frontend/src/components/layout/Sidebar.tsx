"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  MoreVertical,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

const STORAGE_KEY = "contextai.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      className={`flex h-full shrink-0 flex-col bg-sidebar text-[#f0ebe3] transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-[220px]"
      }`}
    >
      <div
        className={`flex items-center pt-6 pb-8 ${
          collapsed ? "flex-col gap-3 px-2" : "gap-2.5 px-5"
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        {!collapsed && (
          <span className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight">
            ContextAI
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="rounded-lg p-1.5 text-[#a39b90] transition-colors hover:bg-sidebar-hover hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className={`flex flex-col gap-1 ${collapsed ? "px-2" : "px-3"}`}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`flex items-center rounded-xl text-[14px] transition-colors ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
              } ${
                active
                  ? "bg-teal text-white"
                  : "text-[#c9c2b8] hover:bg-sidebar-hover hover:text-white"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div
        className={`mt-auto border-t border-white/10 py-4 ${
          collapsed ? "px-2" : "px-3"
        }`}
      >
        <div
          className={`flex items-center rounded-xl ${
            collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2"
          }`}
          title="Harshul"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5c534a] text-[13px] font-medium text-white">
            H
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">
                  Harshul
                </p>
                <p className="text-[11px] text-[#a39b90]">Student</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-[#a39b90] transition-colors hover:bg-sidebar-hover hover:text-white"
                aria-label="Profile menu"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
