// src/app/(auth)/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Shield, Terminal, Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "magic">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    toast.success("Authentication successful");
    router.push(redirect);
    router.refresh();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setError(error.message);
    } else {
      toast.success("Magic link sent! Check your email.");
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "github" | "google" | "azure") => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider === "azure" ? "azure" : provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-sentinel-900">
      {/* Animated background */}
      <div className="absolute inset-0 cyber-grid-bg opacity-30" />
      <div className="absolute inset-0 bg-glow-cyan opacity-20" />
      <div className="absolute inset-0 bg-glow-purple opacity-10" />

      {/* Animated particles */}
      {isMounted && [...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyber-cyan opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
          }}
        />
      ))}

      {/* Scan line */}
      <div className="scan-line" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md px-4"
      >
        {/* Logo & Header */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 relative">
            <div className="absolute inset-0 rounded-2xl bg-cyber-cyan opacity-10 animate-pulse-slow" />
            <div
              className="absolute inset-0 rounded-2xl border border-cyber-cyan opacity-30"
              style={{
                boxShadow: "0 0 30px rgba(0, 245, 255, 0.2)",
              }}
            />
            <Shield
              className="w-10 h-10 text-cyber-cyan relative z-10"
              style={{ filter: "drop-shadow(0 0 8px rgba(0, 245, 255, 0.6))" }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            <span className="text-neon-cyan">Sentinel</span>
            <span className="text-white">AI</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Enterprise Agentic Security Operating System
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Terminal className="w-3 h-3 text-cyber-emerald" />
            <span className="terminal-text text-xs">
              v2.4.0 // SECURE_CONNECT
            </span>
          </div>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="glass-card rounded-2xl p-8"
        >
          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10 mb-6">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
                mode === "signin"
                  ? "bg-cyber-cyan/10 text-cyber-cyan border-r border-white/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
            <button
              onClick={() => setMode("magic")}
              className={`flex-1 py-2.5 text-sm font-medium transition-all duration-200 ${
                mode === "magic"
                  ? "bg-cyber-cyan/10 text-cyber-cyan"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form
            onSubmit={mode === "signin" ? handleEmailSignIn : handleMagicLink}
            className="space-y-4"
          >
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@corp.io"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/20 transition-all duration-200"
                />
              </div>
            </div>

            {/* Password (sign in mode only) */}
            {mode === "signin" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyber-cyan/50 focus:ring-1 focus:ring-cyber-cyan/20 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-cyber rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyber-cyan/30 border-t-cyber-cyan rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : mode === "signin" ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Secure Sign In</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Send Magic Link</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">OR CONTINUE WITH</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                provider: "github" as const,
                icon: (props: any) => (
                  <svg className={props.className} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.5303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                ),
                label: "GitHub",
              },
              {
                provider: "google" as const,
                icon: (props: any) => (
                  <svg className={props.className} viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                ),
                label: "Google",
              },
              {
                provider: "azure" as const,
                icon: (props: any) => (
                  <svg className={props.className} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.5 2L2 19.5h4.5L11.5 10l5 9.5H22L11.5 2z" />
                  </svg>
                ),
                label: "Microsoft",
              },
            ].map(({ provider, icon: Icon, label }) => (
              <button
                key={provider}
                onClick={() => handleOAuth(provider)}
                disabled={loading}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:border-white/20 hover:bg-white/10 transition-all duration-200 disabled:opacity-50"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">{label}</span>
              </button>
            ))}
          </div>

          {/* Security Note */}
          <div className="mt-6 p-3 rounded-lg bg-cyber-cyan/5 border border-cyber-cyan/20">
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-cyber-cyan mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                All sessions are protected with TLS 1.3, JWT (RS256), and
                mandatory MFA for privileged roles.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Enterprise SSO?{" "}
          <a href="/sso" className="text-cyber-cyan hover:underline">
            Configure SAML
          </a>
        </p>
      </motion.div>
    </div>
  );
}