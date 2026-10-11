// src/components/layout/Header.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  Bell,
  Search,
  Terminal,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { useAppStore } from "@/store";

const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    type: "critical",
    message: "Critical SQLi found in payment-service",
    time: "2m ago",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
  {
    id: "2",
    type: "success",
    message: "Consensus reached: 3 high findings verified",
    time: "8m ago",
    icon: CheckCircle,
    iconColor: "text-emerald-400",
  },
  {
    id: "3",
    type: "info",
    message: "SOC2 compliance scan completed",
    time: "1h ago",
    icon: Shield,
    iconColor: "text-cyan-400",
  },
  {
    id: "4",
    type: "warning",
    message: "DAST scan queued for api-gateway",
    time: "2h ago",
    icon: Clock,
    iconColor: "text-yellow-400",
  },
];

interface HeaderProps {
  user: User;
  role?: string | null;
}

export function Header({ user, role }: HeaderProps) {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { unreadNotifications } = useAppStore();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const userInitials = user.email
    ? user.email.substring(0, 2).toUpperCase()
    : "SA";

  return (
    <header
      className="relative z-50 h-16 border-b border-white/5 flex items-center justify-between px-6 flex-shrink-0"
      style={{
        background: "rgba(4, 9, 16, 0.95)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Search */}
      <div className="relative max-w-sm w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search findings, agents, projects..."
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/40 focus:ring-1 focus:ring-cyber-cyan/20 transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-muted-foreground border border-white/10 rounded">
          ⌘K
        </kbd>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Terminal Quick Access */}
        <button
          onClick={() => router.push("/dashboard/agents")}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-emerald/10 border border-cyber-emerald/20 text-cyber-emerald text-xs font-mono hover:bg-cyber-emerald/20 transition-all duration-200"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Agent Console</span>
          <div className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 || MOCK_NOTIFICATIONS.length > 0 ? (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-xs text-white font-bold leading-none">
                  {MOCK_NOTIFICATIONS.length}
                </span>
              </div>
            ) : null}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 bg-[#09121d] rounded-xl border border-white/15 shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                  <h3 className="text-sm font-semibold text-foreground">
                    Notifications
                  </h3>
                  <button className="text-xs text-cyber-cyan hover:underline">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {MOCK_NOTIFICATIONS.map((notif, i) => {
                    const Icon = notif.icon;
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-start gap-3 p-4 hover:bg-white/10 transition-colors cursor-pointer border-b border-white/5 last:border-0"
                      >
                        <Icon
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${notif.iconColor}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-relaxed">
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notif.time}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyber-cyan/30 to-cyber-purple/30 border border-white/10 flex items-center justify-center">
              <span className="text-xs font-bold text-foreground">
                {userInitials}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-medium text-foreground leading-none">
                {user.email?.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {role ?? "Viewer"}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-60 bg-[#09121d] rounded-xl border border-white/15 shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
              >
                <div className="p-3.5 border-b border-white/10 bg-white/5">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Shield className="w-3.5 h-3.5 text-cyber-cyan" />
                    <span className="text-xs text-cyber-cyan font-semibold">
                      {role ?? "Viewer"}
                    </span>
                  </div>
                </div>
                <div className="p-1.5">
                  {[
                    {
                      icon: UserIcon,
                      label: "Profile",
                      href: "/dashboard/settings/profile",
                    },
                    {
                      icon: Settings,
                      label: "Settings",
                      href: "/dashboard/settings",
                    },
                  ].map(({ icon: Icon, label, href }) => (
                    <button
                      key={label}
                      onClick={() => {
                        setShowUserMenu(false);
                        router.push(href);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all text-left font-medium"
                    >
                      <Icon className="w-4 h-4 text-cyber-cyan" />
                      <span>{label}</span>
                    </button>
                  ))}
                  <div className="border-t border-white/5 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-all text-left font-medium"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click outside to close */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
}
