// src/app/page.tsx
"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import {
  Shield,
  Bot,
  Zap,
  Lock,
  ChevronRight,
  Terminal,
  CheckCircle,
  ArrowRight,
  Globe,
  Layers,
  Eye,
  GitBranch,
  FileCheck,
  AlertTriangle,
  TrendingDown,
  Star,
} from "lucide-react";

const FEATURES = [
  {
    icon: Bot,
    color: "#00f5ff",
    title: "50+ Specialized AI Agents",
    description:
      "Director, Planner, SAST, DAST, SCA, Secrets, Compliance, and AI Security agents working in concert.",
  },
  {
    icon: Shield,
    color: "#b347ea",
    title: "Defense-in-Depth Architecture",
    description:
      "Zero-trust agent isolation, prompt guardrails, consensus verification, and cryptographic audit trails.",
  },
  {
    icon: Zap,
    color: "#ff3366",
    title: "Autonomous Remediation",
    description:
      "From vulnerability detection to a verified GitHub PR in under 5 minutes — no human required.",
  },
  {
    icon: FileCheck,
    color: "#00ff88",
    title: "Always Audit-Ready",
    description:
      "Real-time SOC2, ISO 27001, PCI DSS, HIPAA, and GDPR compliance mapping via dedicated agents.",
  },
  {
    icon: Eye,
    color: "#ffd700",
    title: "AI Security Testing",
    description:
      "Detect prompt injections, jailbreaks, and LLM vulnerabilities before attackers find them.",
  },
  {
    icon: TrendingDown,
    color: "#ff6b35",
    title: "90% Fewer False Positives",
    description:
      "Multi-agent consensus engine validates every finding before it ever reaches your team.",
  },
];

const STATS = [
  { value: "50+", label: "Specialized AI Agents" },
  { value: "<4min", label: "Avg Time to Detect" },
  { value: "90%", label: "False Positive Reduction" },
  { value: "100%", label: "Guardrail Success Rate" },
];

const AGENT_TYPES = [
  { name: "SAST Agent", status: "ACTIVE", color: "#00ff88" },
  { name: "DAST Agent", status: "ACTIVE", color: "#00ff88" },
  { name: "Consensus Engine", status: "ACTIVE", color: "#00f5ff" },
  { name: "Jailbreak Detector", status: "ACTIVE", color: "#b347ea" },
  { name: "PR Review Agent", status: "ACTIVE", color: "#00ff88" },
  { name: "SOC2 Agent", status: "IDLE", color: "#5a8fd0" },
  { name: "Threat Intel Agent", status: "ACTIVE", color: "#ffd700" },
  { name: "Hallucination Detector", status: "ACTIVE", color: "#00f5ff" },
];

const TERMINAL_LINES = [
  { time: "12:34:01", agent: "DIRECTOR", msg: "Scan initiated: github.com/corp/payment-service", color: "#00f5ff" },
  { time: "12:34:02", agent: "PLANNER", msg: "Spawning 5 agents: SAST, SCA, SECRETS, DAST, IaC", color: "#b347ea" },
  { time: "12:34:07", agent: "SAST", msg: "⚠ SQLi found: auth/login.ts:142 [CWE-89] CRITICAL", color: "#ff3366" },
  { time: "12:34:09", agent: "CONSENSUS", msg: "3 agents verified — consensus reached ✓", color: "#00ff88" },
  { time: "12:34:11", agent: "PR_AGENT", msg: "✓ PR #847 created with fix — awaiting approval", color: "#00ff88" },
];

const TESTIMONIALS = [
  {
    quote: "SentinelAI reduced our mean time to detect from 3 days to 4 minutes. It's like having a 50-person security team that never sleeps.",
    author: "Sarah K.",
    role: "CISO, Fortune 500 Fintech",
    avatar: "SK",
  },
  {
    quote: "The consensus engine eliminated our false positive noise completely. Our engineers stopped ignoring security alerts.",
    author: "Marcus T.",
    role: "Head of DevSecOps, SaaS Unicorn",
    avatar: "MT",
  },
  {
    quote: "The AI security testing caught a prompt injection in our LLM chatbot that no other tool detected. Saved us from a serious breach.",
    author: "Priya R.",
    role: "VP Engineering, AI-first Startup",
    avatar: "PR",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);

  return (
    <div className="min-h-screen bg-sentinel-900 overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 h-16 border-b border-white/5"
        style={{ background: "rgba(2, 4, 8, 0.9)", backdropFilter: "blur(16px)" }}>
        <div className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-cyber-cyan" style={{ filter: "drop-shadow(0 0 6px rgba(0,245,255,0.5))" }} />
          <span className="font-bold text-xl text-white">
            Sentinel<span className="text-cyber-cyan">AI</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {["Features", "Agents", "Compliance", "Pricing"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Link href="/login"
            className="btn-cyber rounded-lg px-4 py-2 text-sm font-semibold">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden"
      >
        {/* Background effects */}
        <div className="absolute inset-0 cyber-grid-bg opacity-20" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,245,255,0.08) 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(179,71,234,0.08) 0%, transparent 70%)" }} />
        <div className="scan-line" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyber-cyan/30 bg-cyber-cyan/5 mb-8"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
            <span className="text-xs font-semibold text-cyber-cyan">
              Enterprise Agentic AI Security OS — v2.4
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="text-5xl md:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6"
          >
            Security that{" "}
            <span className="relative inline-block">
              <span className="text-neon-cyan">thinks</span>
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent" />
            </span>
            {" "}for itself
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            50+ specialized AI agents autonomously detect, validate, and remediate
            vulnerabilities across your entire codebase and infrastructure — before
            attackers even know they exist.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link href="/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm bg-cyber-cyan text-sentinel-900 hover:bg-cyber-cyan/90 transition-all shadow-cyber-cyan">
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#demo"
              className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm border border-white/20 text-foreground hover:bg-white/5 transition-all">
              <Terminal className="w-4 h-4" />
              Watch Live Demo
            </Link>
          </motion.div>

          {/* Mini Terminal Demo */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="max-w-3xl mx-auto rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,245,255,0.1)" }}
          >
            {/* Terminal Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5"
              style={{ background: "rgba(6,13,20,0.95)" }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Terminal className="w-3.5 h-3.5 text-cyber-emerald" />
                <span className="text-xs text-muted-foreground font-mono">
                  sentinel-ai — agent trace — live
                </span>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-cyber-emerald animate-pulse" />
            </div>
            {/* Terminal Body */}
            <div className="p-5 space-y-2 font-mono text-xs"
              style={{ background: "rgba(2,4,8,0.95)" }}>
              {TERMINAL_LINES.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.3 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-muted-foreground flex-shrink-0">{line.time}</span>
                  <span className="font-bold w-20 flex-shrink-0" style={{ color: line.color }}>
                    [{line.agent}]
                  </span>
                  <span className="text-gray-300">{line.msg}</span>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5 }}
                className="flex items-center gap-3 text-cyber-emerald"
              >
                <span className="text-muted-foreground">12:34:12</span>
                <span className="font-bold w-20">[SYSTEM]</span>
                <span className="animate-pulse">▋</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Stats Bar */}
      <section className="py-12 border-y border-white/5"
        style={{ background: "rgba(6,13,20,0.8)" }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl font-extrabold text-neon-cyan mb-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            Enterprise Security,{" "}
            <span className="text-neon-purple">Fully Autonomous</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every component built for enterprise scale, zero-trust security, and
            multi-agent collaboration.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="glass-card rounded-xl p-6 border border-white/5 group cursor-default"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all duration-300"
                  style={{ background: `${feature.color}15`, border: `1px solid ${feature.color}30` }}>
                  <Icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Agent Ecosystem Section */}
      <section id="agents" className="py-24 px-6 border-y border-white/5"
        style={{ background: "rgba(6,13,20,0.5)" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-4">
              An ecosystem of{" "}
              <span className="text-neon-cyan">specialized agents</span>
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Each agent is purpose-built, isolated, and least-privileged. The
              Director orchestrates. The Planner decomposes. Specialist agents
              execute. The Consensus Engine validates. All in under 5 minutes.
            </p>
            <div className="space-y-3">
              {[
                "Defensive: SAST, DAST, SCA, Secrets, IaC Review",
                "Offensive: Exploit Validation, Recon, Payload Generation",
                "AI Security: Prompt Injection, Jailbreak Detection",
                "Compliance: SOC2, ISO 27001, HIPAA, PCI DSS, GDPR",
                "Verification: Consensus Engine, Hallucination Detector",
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="w-4 h-4 text-cyber-emerald flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </motion.div>
              ))}
            </div>
            <Link href="/login"
              className="inline-flex items-center gap-2 mt-8 btn-cyber rounded-xl px-6 py-3 font-semibold text-sm">
              Explore Agent Ecosystem
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Agent Grid Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-3"
          >
            {AGENT_TYPES.map((agent, i) => (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="glass-card rounded-xl p-4 border border-white/5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{
                    background: agent.color,
                    boxShadow: `0 0 6px ${agent.color}`,
                    animation: agent.status === "ACTIVE" ? "pulse 2s infinite" : undefined,
                  }} />
                  <span className="text-xs font-semibold text-foreground">{agent.name}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: agent.color }}>
                  {agent.status}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-4">
            Trusted by security leaders
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card rounded-xl p-6 border border-white/5"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, si) => (
                  <Star key={si} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyber-cyan/30 to-cyber-purple/30 border border-white/10 flex items-center justify-center">
                  <span className="text-xs font-bold text-foreground">{t.avatar}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 border-t border-white/5 text-center"
        style={{ background: "rgba(6,13,20,0.8)" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <Shield className="w-12 h-12 text-cyber-cyan mx-auto mb-6"
            style={{ filter: "drop-shadow(0 0 12px rgba(0,245,255,0.4))" }} />
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to secure at the speed of AI?
          </h2>
          <p className="text-muted-foreground mb-8">
            Join enterprise teams shipping secure products faster with
            SentinelAI&apos;s autonomous multi-agent security platform.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold bg-cyber-cyan text-sentinel-900 hover:bg-cyber-cyan/90 transition-all shadow-cyber-cyan">
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyber-cyan" />
            <span className="font-bold text-white">Sentinel<span className="text-cyber-cyan">AI</span></span>
            <span className="text-xs text-muted-foreground ml-2">v2.4.0</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2025 SentinelAI. Enterprise Agentic Security OS. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {["Privacy", "Terms", "Security", "Docs"].map((link) => (
              <a key={link} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}