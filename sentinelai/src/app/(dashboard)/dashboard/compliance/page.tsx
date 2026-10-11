// src/app/(dashboard)/dashboard/compliance/page.tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Shield,
  Calendar,
  TrendingUp,
  Filter,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { motion as m } from "framer-motion";
import type { Metadata } from "next";

const FRAMEWORKS = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    score: 94,
    color: "#00f5ff",
    lastAssessed: "2025-07-01",
    nextAudit: "2025-10-01",
    controls: {
      total: 93,
      passing: 87,
      failing: 4,
      notApplicable: 2,
    },
    categories: [
      {
        name: "Security (CC)",
        score: 96,
        controls: [
          { id: "CC1.1", name: "COSO Principle 1 — Integrity & Ethics", status: "PASS" },
          { id: "CC2.1", name: "Board Oversight of Internal Controls", status: "PASS" },
          { id: "CC6.1", name: "Logical & Physical Access Controls", status: "PASS" },
          { id: "CC6.3", name: "Access Removal on Termination", status: "FAIL" },
          { id: "CC7.1", name: "System Monitoring", status: "PASS" },
          { id: "CC8.1", name: "Change Management Controls", status: "PASS" },
        ],
      },
      {
        name: "Availability (A)",
        score: 91,
        controls: [
          { id: "A1.1", name: "Availability Commitments Defined", status: "PASS" },
          { id: "A1.2", name: "Performance Monitoring", status: "PASS" },
          { id: "A1.3", name: "Recovery Procedures Tested", status: "FAIL" },
        ],
      },
      {
        name: "Confidentiality (C)",
        score: 100,
        controls: [
          { id: "C1.1", name: "Confidential Information Identified", status: "PASS" },
          { id: "C1.2", name: "Confidential Data Disposed Properly", status: "PASS" },
        ],
      },
    ],
  },
  {
    id: "iso27001",
    name: "ISO 27001:2022",
    score: 89,
    color: "#b347ea",
    lastAssessed: "2025-06-28",
    nextAudit: "2026-01-01",
    controls: { total: 110, passing: 98, failing: 8, notApplicable: 4 },
    categories: [
      {
        name: "Organizational Controls",
        score: 92,
        controls: [
          { id: "5.1", name: "Policies for information security", status: "PASS" },
          { id: "5.7", name: "Threat intelligence", status: "PASS" },
          { id: "5.23", name: "Information security for use of cloud services", status: "FAIL" },
        ],
      },
      {
        name: "Technological Controls",
        score: 87,
        controls: [
          { id: "8.8", name: "Management of technical vulnerabilities", status: "PASS" },
          { id: "8.20", name: "Networks security", status: "PASS" },
          { id: "8.25", name: "Secure development lifecycle", status: "FAIL" },
        ],
      },
    ],
  },
  {
    id: "pci",
    name: "PCI DSS v4.0",
    score: 91,
    color: "#00ff88",
    lastAssessed: "2025-07-05",
    nextAudit: "2026-07-01",
    controls: { total: 264, passing: 240, failing: 18, notApplicable: 6 },
    categories: [
      {
        name: "Req 6 — Secure Systems",
        score: 94,
        controls: [
          { id: "6.2.1", name: "All system components protected from known vulnerabilities", status: "PASS" },
          { id: "6.3.1", name: "Security vulnerabilities identified and managed", status: "PASS" },
          { id: "6.4.1", name: "Web-facing applications protected against attacks", status: "FAIL" },
        ],
      },
      {
        name: "Req 12 — Security Policy",
        score: 88,
        controls: [
          { id: "12.3.1", name: "Risk assessment performed", status: "PASS" },
          { id: "12.6.1", name: "Security awareness program maintained", status: "PASS" },
          { id: "12.10.1", name: "Incident response plan in place", status: "FAIL" },
        ],
      },
    ],
  },
  {
    id: "hipaa",
    name: "HIPAA",
    score: 86,
    color: "#ffd700",
    lastAssessed: "2025-06-15",
    nextAudit: "2025-12-15",
    controls: { total: 71, passing: 61, failing: 8, notApplicable: 2 },
    categories: [
      {
        name: "Administrative Safeguards",
        score: 88,
        controls: [
          { id: "164.308(a)(1)", name: "Security Management Process", status: "PASS" },
          { id: "164.308(a)(3)", name: "Workforce Authorization", status: "PASS" },
          { id: "164.308(a)(6)", name: "Security Incident Procedures", status: "FAIL" },
        ],
      },
    ],
  },
  {
    id: "gdpr",
    name: "GDPR",
    score: 97,
    color: "#ff6b35",
    lastAssessed: "2025-07-06",
    nextAudit: "2026-01-06",
    controls: { total: 58, passing: 56, failing: 1, notApplicable: 1 },
    categories: [
      {
        name: "Data Subject Rights",
        score: 100,
        controls: [
          { id: "Art.15", name: "Right of access by data subject", status: "PASS" },
          { id: "Art.17", name: "Right to erasure", status: "PASS" },
          { id: "Art.20", name: "Right to data portability", status: "PASS" },
        ],
      },
      {
        name: "Data Processing",
        score: 95,
        controls: [
          { id: "Art.25", name: "Data protection by design", status: "PASS" },
          { id: "Art.32", name: "Security of processing", status: "FAIL" },
        ],
      },
    ],
  },
];

const RADAR_DATA = FRAMEWORKS.map((f) => ({
  framework: f.name.split(" ")[0],
  score: f.score,
}));

type ControlStatus = "PASS" | "FAIL" | "NA";

function StatusBadge({ status }: { status: ControlStatus }) {
  const config = {
    PASS: { icon: CheckCircle, color: "#00ff88", bg: "rgba(0,255,136,0.1)", border: "rgba(0,255,136,0.3)", label: "PASS" },
    FAIL: { icon: XCircle, color: "#ff3366", bg: "rgba(255,51,102,0.1)", border: "rgba(255,51,102,0.3)", label: "FAIL" },
    NA: { icon: AlertTriangle, color: "#ffd700", bg: "rgba(255,215,0,0.1)", border: "rgba(255,215,0,0.3)", label: "N/A" },
  }[status];

  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function FrameworkCard({
  framework,
  isSelected,
  onSelect,
}: {
  framework: typeof FRAMEWORKS[0];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const passRate = Math.round((framework.controls.passing / framework.controls.total) * 100);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onSelect}
      className={`glass-card rounded-xl p-5 border cursor-pointer transition-all duration-200 ${
        isSelected ? "border-opacity-50" : "border-white/5 hover:border-white/10"
      }`}
      style={isSelected ? { borderColor: `${framework.color}40`, background: `${framework.color}05` } : {}}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-bold text-foreground">{framework.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last assessed {new Date(framework.lastAssessed).toLocaleDateString()}
          </p>
        </div>
        <div className="text-2xl font-extrabold font-mono" style={{ color: framework.color }}>
          {framework.score}%
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${framework.score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${framework.color}60, ${framework.color})` }}
        />
      </div>

      {/* Control counts */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Passing", value: framework.controls.passing, color: "#00ff88" },
          { label: "Failing", value: framework.controls.failing, color: "#ff3366" },
          { label: "N/A", value: framework.controls.notApplicable, color: "#ffd700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white/3 rounded-lg py-2">
            <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function CategoryAccordion({ category }: { category: typeof FRAMEWORKS[0]["categories"][0] }) {
  const [open, setOpen] = useState(false);
  const passing = category.controls.filter((c) => c.status === "PASS").length;

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            {passing}/{category.controls.length} controls passing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold font-mono text-cyber-cyan">{category.score}%</div>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/5"
          >
            {category.controls.map((control, i) => (
              <motion.div
                key={control.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-cyber-cyan font-semibold w-24">{control.id}</span>
                  <span className="text-xs text-muted-foreground">{control.name}</span>
                </div>
                <StatusBadge status={control.status as ControlStatus} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CompliancePage() {
  const [selectedFramework, setSelectedFramework] = useState(FRAMEWORKS[0]);
  const [runningAudit, setRunningAudit] = useState(false);

  const handleRunAudit = async () => {
    setRunningAudit(true);
    await new Promise((r) => setTimeout(r, 2500));
    setRunningAudit(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Compliance Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time framework coverage via autonomous compliance agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunAudit}
            disabled={runningAudit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningAudit ? "animate-spin" : ""}`} />
            {runningAudit ? "Scanning..." : "Run Full Audit"}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-foreground transition-all">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Top section: Framework cards + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar */}
        <div className="glass-card rounded-xl border border-white/5 p-6 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyber-cyan" />
            Coverage Overview
          </h3>
          <div className="flex-1" style={{ minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis dataKey="framework" tick={{ fontSize: 10, fill: "#64748b" }} />
                <Radar name="Score" dataKey="score" stroke="#00f5ff" fill="#00f5ff" fillOpacity={0.1} strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(6,13,20,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center">
            <p className="text-2xl font-bold text-neon-cyan font-mono">
              {Math.round(FRAMEWORKS.reduce((s, f) => s + f.score, 0) / FRAMEWORKS.length)}%
            </p>
            <p className="text-xs text-muted-foreground">Average Compliance Score</p>
          </div>
        </div>

        {/* Framework Cards Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FRAMEWORKS.map((fw) => (
            <FrameworkCard
              key={fw.id}
              framework={fw}
              isSelected={selectedFramework.id === fw.id}
              onSelect={() => setSelectedFramework(fw)}
            />
          ))}
        </div>
      </div>

      {/* Detailed Framework View */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedFramework.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass-card rounded-xl border border-white/5 p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileCheck className="w-5 h-5" style={{ color: selectedFramework.color }} />
                {selectedFramework.name} — Control Details
              </h3>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Last assessed: {new Date(selectedFramework.lastAssessed).toLocaleDateString()}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Next audit: {new Date(selectedFramework.nextAudit).toLocaleDateString()}
                </span>
              </div>
            </div>
            <span className="text-3xl font-extrabold font-mono"
              style={{ color: selectedFramework.color }}>
              {selectedFramework.score}%
            </span>
          </div>

          <div className="space-y-3">
            {selectedFramework.categories.map((cat) => (
              <CategoryAccordion key={cat.name} category={cat} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

  // src/app/(dashboard)/dashboard/compliance/page.tsx
// "use client";

// import { useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   FileCheck, Shield, ChevronDown, ChevronRight, CheckCircle,
//   XCircle, AlertTriangle, Clock, Download, RefreshCw, Info,
//   ExternalLink, TrendingUp,
// } from "lucide-react";
// import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer as RC2 } from "recharts";

// const FRAMEWORKS = [
//   {
//     id: "soc2", name: "SOC 2 Type II", score: 94, color: "#00f5ff", lastAssessed: "2024-07-05T10:00:00Z",
//     categories: [
//       { name: "Security (CC)", pass: 34, fail: 2, total: 36 },
//       { name: "Availability (A)", pass: 8, fail: 0, total: 8 },
//       { name: "Confidentiality (C)", pass: 11, fail: 1, total: 12 },
//       { name: "Processing Integrity (PI)", pass: 15, fail: 1, total: 16 },
//       { name: "Privacy (P)", pass: 8, fail: 1, total: 9 },
//     ],
//     controls: [
//       { id: "CC1.1", name: "Control Environment - COSO Principle 1", status: "PASS", description: "The entity demonstrates a commitment to integrity and ethical values." },
//       { id: "CC6.1", name: "Logical Access Controls", status: "PASS", description: "The entity implements logical access security software, infrastructure, and architectures." },
//       { id: "CC6.7", name: "Transmission Controls", status: "FAIL", description: "The entity restricts the transmission, movement, and removal of information to authorized internal and external users." },
//       { id: "CC7.2", name: "Security Monitoring", status: "PASS", description: "The entity monitors system components and operations." },
//       { id: "A1.1", name: "Availability Commitments", status: "PASS", description: "The entity maintains, monitors, and evaluates current processing capacity." },
//     ],
//   },
//   {
//     id: "iso27001", name: "ISO 27001:2022", score: 89, color: "#b347ea", lastAssessed: "2024-07-04T14:00:00Z",
//     categories: [
//       { name: "Organizational Controls", pass: 29, fail: 4, total: 33 },
//       { name: "People Controls", pass: 8, fail: 1, total: 9 },
//       { name: "Physical Controls", pass: 14, fail: 0, total: 14 },
//       { name: "Technological Controls", pass: 47, fail: 7, total: 54 },
//     ],
//     controls: [
//       { id: "5.1", name: "Information security policies", status: "PASS", description: "Policy for information security shall be defined, approved by management, published." },
//       { id: "8.25", name: "Secure development lifecycle", status: "FAIL", description: "Rules for the secure development of software and systems shall be established and applied." },
//       { id: "8.8", name: "Management of technical vulnerabilities", status: "PASS", description: "Information about technical vulnerabilities of information systems shall be obtained." },
//     ],
//   },
//   {
//     id: "pci", name: "PCI DSS v4.0", score: 91, color: "#00ff88", lastAssessed: "2024-07-03T09:00:00Z",
//     categories: [
//       { name: "Build and Maintain Secure Network", pass: 22, fail: 1, total: 23 },
//       { name: "Protect Account Data", pass: 18, fail: 2, total: 20 },
//       { name: "Vulnerability Management", pass: 30, fail: 0, total: 30 },
//       { name: "Strong Access Control", pass: 48, fail: 5, total: 53 },
//       { name: "Monitor and Test Networks", pass: 40, fail: 3, total: 43 },
//     ],
//     controls: [
//       { id: "6.3.3", name: "Security patches applied", status: "PASS", description: "All system components are protected from known vulnerabilities." },
//       { id: "8.2.1", name: "User IDs and authentication", status: "PASS", description: "All user IDs and authentication factors for users and administrators are strictly managed." },
//       { id: "10.3.1", name: "Audit log protection", status: "FAIL", description: "Read access to audit logs is limited to only those with a job-related need." },
//     ],
//   },
//   {
//     id: "hipaa", name: "HIPAA Security Rule", score: 86, color: "#ffd700", lastAssessed: "2024-07-01T11:00:00Z",
//     categories: [
//       { name: "Administrative Safeguards", pass: 21, fail: 3, total: 24 },
//       { name: "Physical Safeguards", pass: 16, fail: 1, total: 17 },
//       { name: "Technical Safeguards", pass: 24, fail: 4, total: 28 },
//     ],
//     controls: [
//       { id: "164.308(a)(1)", name: "Risk Analysis", status: "PASS", description: "Conduct an accurate and thorough assessment of potential risks." },
//       { id: "164.312(a)(2)(i)", name: "Unique User Identification", status: "FAIL", description: "Assign a unique name and/or number for identifying and tracking user identity." },
//     ],
//   },
// ];

// const TREND_DATA = [
//   { month: "Feb", soc2: 87, iso: 82, pci: 85, hipaa: 79 },
//   { month: "Mar", soc2: 89, iso: 84, pci: 87, hipaa: 81 },
//   { month: "Apr", soc2: 90, iso: 85, pci: 88, hipaa: 83 },
//   { month: "May", soc2: 92, iso: 87, pci: 90, hipaa: 84 },
//   { month: "Jun", soc2: 93, iso: 88, pci: 91, hipaa: 85 },
//   { month: "Jul", soc2: 94, iso: 89, pci: 91, hipaa: 86 },
// ];

// function ControlRow({ control, color }: { control: { id: string; name: string; status: string; description: string }; color: string }) {
//   const [expanded, setExpanded] = useState(false);
//   const isPassing = control.status === "PASS";

//   return (
//     <div className="border-b border-white/5 last:border-0">
//       <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-all text-left">
//         {isPassing
//           ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
//           : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
//         <span className="text-xs font-mono text-muted-foreground w-20 flex-shrink-0">{control.id}</span>
//         <span className="text-sm text-foreground flex-1 truncate">{control.name}</span>
//         <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${isPassing ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>{control.status}</span>
//         {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
//       </button>
//       <AnimatePresence>
//         {expanded && (
//           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
//             className="overflow-hidden">
//             <div className="px-4 pb-3 pl-11">
//               <p className="text-xs text-muted-foreground leading-relaxed">{control.description}</p>
//               {!isPassing && (
//                 <div className="flex items-center gap-2 mt-2">
//                   <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
//                   <span className="text-xs text-yellow-400">Remediation required — assign to Security Engineer</span>
//                 </div>
//               )}
//             </div>
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

// function FrameworkCard({ fw, isSelected, onClick }: { fw: typeof FRAMEWORKS[0]; isSelected: boolean; onClick: () => void }) {
//   const total = fw.categories.reduce((s, c) => s + c.total, 0);
//   const passing = fw.categories.reduce((s, c) => s + c.pass, 0);
//   const failing = total - passing;

//   return (
//     <motion.button whileHover={{ y: -2 }} onClick={onClick}
//       className={`w-full p-5 rounded-xl border text-left transition-all duration-200 ${isSelected ? "border-opacity-50" : "border-white/5 bg-white/2 hover:border-white/10"}`}
//       style={isSelected ? { borderColor: `${fw.color}40`, background: `${fw.color}05`, boxShadow: `0 0 20px ${fw.color}10` } : {}}>
//       <div className="flex items-start justify-between mb-3">
//         <div>
//           <p className="text-sm font-bold text-foreground">{fw.name}</p>
//           <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
//             <Clock className="w-3 h-3" /> Assessed {new Date(fw.lastAssessed).toLocaleDateString()}
//           </p>
//         </div>
//         <div className="text-right">
//           <p className="text-2xl font-bold font-mono" style={{ color: fw.color }}>{fw.score}%</p>
//           <p className="text-xs text-muted-foreground">{passing}/{total} controls</p>
//         </div>
//       </div>
//       <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
//         <motion.div initial={{ width: 0 }} animate={{ width: `${fw.score}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
//           className="h-full rounded-full" style={{ background: fw.color, boxShadow: `0 0 6px ${fw.color}40` }} />
//       </div>
//       <div className="flex justify-between mt-2 text-xs">
//         <span className="text-emerald-400">{passing} passing</span>
//         <span className="text-red-400">{failing} failing</span>
//       </div>
//     </motion.button>
//   );
// }

// export default function CompliancePage() {
//   const [selectedFw, setSelectedFw] = useState(FRAMEWORKS[0]);

//   const CustomTooltip = ({ active, payload, label }: any) => {
//     if (active && payload?.length) return (
//       <div className="glass-card rounded-lg p-3 border border-white/10 text-xs">
//         <p className="font-semibold text-foreground mb-1">{label}</p>
//         {payload.map((p: any) => <div key={p.name} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: p.color }} /><span className="text-muted-foreground">{p.name}:</span><span className="text-foreground font-mono">{p.value}%</span></div>)}
//       </div>
//     );
//     return null;
//   };

//   return (
//     <div className="space-y-6 animate-fade-in">
//       <div className="flex items-center justify-between">
//         <div>
//           <h1 className="text-2xl font-bold text-foreground tracking-tight">Compliance</h1>
//           <p className="text-sm text-muted-foreground mt-1">Continuous compliance monitoring across all frameworks</p>
//         </div>
//         <div className="flex items-center gap-2">
//           <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-sm hover:text-foreground transition-all">
//             <RefreshCw className="w-4 h-4" /> Re-assess
//           </button>
//           <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-all">
//             <Download className="w-4 h-4" /> Export Report
//           </button>
//         </div>
//       </div>

//       {/* Trend Chart */}
//       <div className="glass-card rounded-xl border border-white/5 p-5">
//         <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
//           <TrendingUp className="w-4 h-4 text-cyber-cyan" /> Compliance Score Trend (6 months)
//         </h3>
//         <div className="h-44">
//           <ResponsiveContainer width="100%" height="100%">
//             <BarChart data={TREND_DATA} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
//               <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
//               <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
//               <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
//               <Tooltip content={<CustomTooltip />} />
//               {[
//                 { key: "soc2", color: "#00f5ff" },
//                 { key: "iso", color: "#b347ea" },
//                 { key: "pci", color: "#00ff88" },
//                 { key: "hipaa", color: "#ffd700" },
//               ].map(({ key, color }) => (
//                 <Bar key={key} dataKey={key} fill={color} opacity={0.7} radius={[3, 3, 0, 0]} />
//               ))}
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//         {/* Framework List */}
//         <div className="space-y-3">
//           {FRAMEWORKS.map(fw => (
//             <FrameworkCard key={fw.id} fw={fw} isSelected={selectedFw.id === fw.id} onClick={() => setSelectedFw(fw)} />
//           ))}
//         </div>

//         {/* Framework Detail */}
//         <div className="lg:col-span-2 space-y-4">
//           <AnimatePresence mode="wait">
//             <motion.div key={selectedFw.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
//               {/* Overview */}
//               <div className="glass-card rounded-xl border border-white/5 p-5 mb-4">
//                 <div className="flex items-start justify-between mb-5">
//                   <div>
//                     <h2 className="text-lg font-bold text-foreground">{selectedFw.name}</h2>
//                     <p className="text-xs text-muted-foreground mt-1">
//                       Last assessed {new Date(selectedFw.lastAssessed).toLocaleString()}
//                     </p>
//                   </div>
//                   <div className="text-right">
//                     <p className="text-4xl font-bold font-mono" style={{ color: selectedFw.color }}>{selectedFw.score}%</p>
//                     <div className="flex items-center justify-end gap-1 mt-1 text-emerald-400 text-xs">
//                       <TrendingUp className="w-3 h-3" /> +4% vs last month
//                     </div>
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                   {selectedFw.categories.map(cat => (
//                     <div key={cat.name} className="p-3 rounded-lg bg-white/3 border border-white/5">
//                       <div className="flex items-center justify-between mb-2">
//                         <p className="text-xs font-semibold text-foreground truncate pr-2">{cat.name}</p>
//                         <span className="text-xs font-mono text-muted-foreground flex-shrink-0">{cat.pass}/{cat.total}</span>
//                       </div>
//                       <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
//                         <div className="h-full rounded-full transition-all duration-700"
//                           style={{ width: `${(cat.pass / cat.total) * 100}%`, background: selectedFw.color, boxShadow: `0 0 6px ${selectedFw.color}40` }} />
//                       </div>
//                       {cat.fail > 0 && (
//                         <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
//                           <XCircle className="w-3 h-3" /> {cat.fail} failing
//                         </p>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>

//               {/* Controls */}
//               <div className="glass-card rounded-xl border border-white/5 overflow-hidden">
//                 <div className="flex items-center justify-between p-4 border-b border-white/5">
//                   <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
//                     <Shield className="w-4 h-4 text-cyber-cyan" /> Control Details
//                   </h3>
//                   <div className="flex items-center gap-3 text-xs text-muted-foreground">
//                     <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Passing</span>
//                     <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-red-400" /> Failing</span>
//                   </div>
//                 </div>
//                 <div>
//                   {selectedFw.controls.map(control => (
//                     <ControlRow key={control.id} control={control} color={selectedFw.color} />
//                   ))}
//                 </div>
//                 <div className="p-4 border-t border-white/5">
//                   <button className="text-xs text-cyber-cyan hover:underline flex items-center gap-1">
//                     View all {selectedFw.categories.reduce((s, c) => s + c.total, 0)} controls
//                     <ExternalLink className="w-3 h-3" />
//                   </button>
//                 </div>
//               </div>
//             </motion.div>
//           </AnimatePresence>
//         </div>
//       </div>
//     </div>
//   );
// }