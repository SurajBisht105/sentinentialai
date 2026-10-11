// src/app/(dashboard)/dashboard/agents/page.tsx
"use client";

import { useState, useCallback, useEffect, useMemo, memo } from "react";
import dynamic from "next/dynamic";
// Lazily load ReactFlow — it's heavy (~200KB) and crashes SSR
const ReactFlow = dynamic(() => import("reactflow").then((m) => m.default), {
  ssr: false,
});
const Background = dynamic(
  () => import("reactflow").then((m) => m.Background),
  { ssr: false },
);
const Controls = dynamic(() => import("reactflow").then((m) => m.Controls), {
  ssr: false,
});
const MiniMap = dynamic(() => import("reactflow").then((m) => m.MiniMap), {
  ssr: false,
});
import {
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Play,
  RefreshCw,
  Terminal,
  Layers,
  Info,
  Zap,
  Shield,
  Search,
  CheckCircle,
  AlertTriangle,
  Brain,
} from "lucide-react";
import { AgentStatus } from "@/types";
import { getAgentStatusColor } from "@/lib/utils";
import { useScans } from "@/hooks/useScans";
import { useAgentLogs } from "@/hooks/useAgentLogs";

// Custom Agent Node Component
const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const statusColor = getAgentStatusColor(data.status);

  return (
    <div
      className="relative px-4 py-3 rounded-xl border min-w-[150px] group cursor-pointer transition-all duration-200 hover:scale-105"
      style={{
        background: "rgba(6, 13, 20, 0.95)",
        borderColor: `${statusColor}30`,
        boxShadow: `0 0 15px ${statusColor}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: "blur(12px)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: statusColor, border: "none", width: 8, height: 8 }}
      />

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: statusColor,
            boxShadow: `0 0 6px ${statusColor}`,
            animation:
              data.status === "ACTIVE" ? "pulse 1.5s infinite" : undefined,
          }}
        />
        <span className="text-xs font-bold text-foreground truncate">
          {data.label}
        </span>
      </div>

      {/* Metrics */}
      {data.tokens && (
        <div className="text-xs text-muted-foreground font-mono">
          {data.tokens} tokens
        </div>
      )}
      {data.findings !== undefined && (
        <div className="text-xs mt-0.5" style={{ color: statusColor }}>
          {data.findings} findings
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: statusColor, border: "none", width: 8, height: 8 }}
      />
    </div>
  );
});

const nodeTypes = { agentNode: AgentNode };
const edgeTypes = {};

const INITIAL_NODES: Node[] = [
  // 1. Core Orchestration
  {
    id: "director",
    type: "agentNode",
    position: { x: 450, y: 20 },
    data: { label: "Director Agent", status: "IDLE" },
  },
  {
    id: "planner",
    type: "agentNode",
    position: { x: 450, y: 130 },
    data: { label: "Planner Agent", status: "IDLE" },
  },

  // 2. Discovery & Probing Layer
  {
    id: "sast",
    type: "agentNode",
    position: { x: 40, y: 250 },
    data: { label: "SAST Agent", status: "IDLE" },
  },
  {
    id: "sca",
    type: "agentNode",
    position: { x: 210, y: 250 },
    data: { label: "SCA Agent", status: "IDLE" },
  },
  {
    id: "secrets",
    type: "agentNode",
    position: { x: 380, y: 250 },
    data: { label: "Secrets Agent", status: "IDLE" },
  },
  {
    id: "schema",
    type: "agentNode",
    position: { x: 550, y: 250 },
    data: { label: "API Schema Crawler", status: "IDLE" },
  },
  {
    id: "dast",
    type: "agentNode",
    position: { x: 720, y: 250 },
    data: { label: "DAST Agent", status: "IDLE" },
  },
  {
    id: "iac",
    type: "agentNode",
    position: { x: 890, y: 250 },
    data: { label: "IaC Agent", status: "IDLE" },
  },

  // 3. Deep Verification & Anti-Hallucination Layer
  {
    id: "taint",
    type: "agentNode",
    position: { x: 40, y: 390 },
    data: { label: "Taint Flow Tracing", status: "IDLE" },
  },
  {
    id: "reachability",
    type: "agentNode",
    position: { x: 210, y: 390 },
    data: { label: "Reachability Analyzer", status: "IDLE" },
  },
  {
    id: "access-control",
    type: "agentNode",
    position: { x: 550, y: 390 },
    data: { label: "BOLA Access Control", status: "IDLE" },
  },
  {
    id: "proof-validator",
    type: "agentNode",
    position: { x: 720, y: 390 },
    data: { label: "Proof Validator", status: "IDLE" },
  },

  // 4. Adversarial Consensus & Adjudication
  {
    id: "debater",
    type: "agentNode",
    position: { x: 300, y: 530 },
    data: { label: "Red-vs-Blue Debater", status: "IDLE" },
  },
  {
    id: "consensus",
    type: "agentNode",
    position: { x: 480, y: 530 },
    data: { label: "Consensus Engine", status: "IDLE" },
  },
  {
    id: "hallucination",
    type: "agentNode",
    position: { x: 660, y: 530 },
    data: { label: "Hallucination Detector", status: "IDLE" },
  },

  // 5. Remediation & Reporting
  {
    id: "pr-review",
    type: "agentNode",
    position: { x: 380, y: 670 },
    data: { label: "PR Review Agent", status: "IDLE" },
  },
  {
    id: "report",
    type: "agentNode",
    position: { x: 580, y: 670 },
    data: { label: "Report Generator", status: "IDLE" },
  },
];

const createEdge = (
  id: string,
  source: string,
  target: string,
  color = "rgba(0, 245, 255, 0.3)",
): Edge => ({
  id,
  source,
  target,
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
  style: { stroke: color, strokeWidth: 1.5, strokeDasharray: "4 2" },
  animated: true,
});

const INITIAL_EDGES: Edge[] = [
  createEdge("e1", "director", "planner"),
  createEdge("e2", "planner", "sast"),
  createEdge("e3", "planner", "sca"),
  createEdge("e4", "planner", "secrets"),
  createEdge("e5", "planner", "schema"),
  createEdge("e6", "planner", "dast"),
  createEdge("e7", "planner", "iac"),

  // Dataflow verification
  createEdge("e8", "sast", "taint"),
  createEdge("e9", "sca", "reachability"),
  createEdge("e10", "schema", "access-control"),
  createEdge("e11", "dast", "proof-validator"),

  // Forward to Debater and Consensus
  createEdge("e12", "taint", "debater"),
  createEdge("e13", "reachability", "debater"),
  createEdge("e14", "secrets", "debater"),
  createEdge("e15", "access-control", "debater"),
  createEdge("e16", "proof-validator", "debater"),
  createEdge("e17", "iac", "debater"),

  createEdge("e18", "debater", "consensus"),
  createEdge("e19", "hallucination", "consensus"),
  createEdge("e20", "consensus", "pr-review"),
  createEdge("e21", "pr-review", "report"),
];

type AgentActivityItem = {
  id: string;
  timestamp?: string;
  agent?: string;
  action?: string;
  status?: "success" | "error";
  details?: string;
};

type AgentConsoleLine = {
  id: string;
  timestamp?: string;
  agent: string;
  action: string;
  status?: "success" | "error";
};

export default function AgentsPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [activity, setActivity] = useState<AgentActivityItem[]>([]);
  const { scans } = useScans();

  const activeScan = useMemo(
    () =>
      scans.find((scan) => scan.status === "RUNNING") ??
      scans.find((scan) => scan.status === "QUEUED") ??
      null,
    [scans],
  );
  const { logs: realtimeLogs } = useAgentLogs(activeScan?.id ?? null, {
    maxLogs: 100,
  });

  useEffect(() => {
    let mounted = true;

    const loadActivity = async () => {
      try {
        const response = await fetch("/api/system/agent-activity");
        if (!response.ok) return;
        const data = (await response.json()) as AgentActivityItem[];
        if (mounted) {
          setActivity(Array.isArray(data) ? data : []);
        }
      } catch {
        if (mounted) {
          setActivity([]);
        }
      }
    };

    loadActivity();
    const timer = window.setInterval(loadActivity, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const activeTypes = new Set(activeScan?.scan_types ?? []);
    const isRunning =
      activeScan?.status === "RUNNING" || activeScan?.status === "QUEUED";

    setNodes((prev) =>
      prev.map((node) => {
        let status: AgentStatus = "IDLE";

        if (node.id === "director" || node.id === "planner") {
          status = isRunning ? "ACTIVE" : "IDLE";
        } else if (node.id === "sast" || node.id === "taint") {
          status = activeTypes.has("SAST") && isRunning ? "ACTIVE" : "IDLE";
        } else if (node.id === "sca" || node.id === "reachability") {
          status = activeTypes.has("SCA") && isRunning ? "ACTIVE" : "IDLE";
        } else if (node.id === "secrets") {
          status = activeTypes.has("SECRETS") && isRunning ? "ACTIVE" : "IDLE";
        } else if (
          node.id === "dast" ||
          node.id === "schema" ||
          node.id === "access-control" ||
          node.id === "proof-validator"
        ) {
          status = activeTypes.has("DAST") && isRunning ? "ACTIVE" : "IDLE";
        } else if (node.id === "iac") {
          status = activeTypes.has("IaC") && isRunning ? "ACTIVE" : "IDLE";
        } else if (
          node.id === "debater" ||
          node.id === "consensus" ||
          node.id === "hallucination" ||
          node.id === "pr-review" ||
          node.id === "report"
        ) {
          status = isRunning ? "ACTIVE" : "IDLE";
        }

        return {
          ...node,
          data: {
            ...node.data,
            status,
            findings:
              node.id === "report"
                ? (activeScan?.finding_count ?? 0)
                : node.data.findings,
          },
        };
      }),
    );
  }, [activeScan, setNodes]);

  const agentStats = useMemo(() => {
    const activeCount = nodes.filter(
      (node) => node.data.status === "ACTIVE",
    ).length;
    const findingsToday = scans
      .filter((scan) => {
        if (!scan.started_at) return false;
        return (
          new Date(scan.started_at).toDateString() === new Date().toDateString()
        );
      })
      .reduce((sum, scan) => sum + (scan.finding_count ?? 0), 0);

    return [
      {
        label: "Total Agents",
        value: String(nodes.length),
        icon: Bot,
        color: "#00f5ff",
      },
      {
        label: "Active",
        value: String(activeCount),
        icon: Play,
        color: "#00ff88",
      },
      {
        label: "Findings Today",
        value: String(findingsToday),
        icon: AlertTriangle,
        color: "#ff6b35",
      },
      {
        label: "Live Events",
        value: String(
          realtimeLogs.length > 0 ? realtimeLogs.length : activity.length,
        ),
        icon: Brain,
        color: "#b347ea",
      },
    ];
  }, [activity.length, nodes, realtimeLogs.length, scans]);

  const consoleLines = useMemo<AgentConsoleLine[]>(() => {
    if (realtimeLogs.length > 0) {
      return realtimeLogs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        agent: log.agent_type,
        action: log.message,
        status: log.level === "ERROR" ? "error" : "success",
      }));
    }

    return activity.map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      agent: item.agent ?? "SYSTEM",
      action: item.action ?? "No message",
      status: item.status,
    }));
  }, [activity, realtimeLogs]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Agent Orchestration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live view of the multi-agent security ecosystem
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-emerald/10 border border-cyber-emerald/20 text-cyber-emerald text-sm hover:bg-cyber-emerald/20 transition-all"
          >
            <Terminal className="w-4 h-4" />
            Agent Console
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-sm hover:bg-cyber-cyan/20 transition-all">
            <Play className="w-4 h-4" />
            New Scan
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {agentStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 border border-white/5 flex items-center gap-3"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${stat.color}15`,
                  border: `1px solid ${stat.color}30`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground font-mono">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Flow Graph */}
        <div className="lg:col-span-3">
          <div
            className="glass-card rounded-xl border border-white/5 overflow-hidden"
            style={{ height: "600px" }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              className="bg-transparent"
            >
              <Background color="rgba(0, 245, 255, 0.05)" gap={30} size={1} />
              <Controls
                style={{
                  background: "rgba(6, 13, 20, 0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
              />
              <MiniMap
                style={{
                  background: "rgba(6, 13, 20, 0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
                nodeColor={(node) =>
                  getAgentStatusColor(node.data?.status ?? "IDLE")
                }
              />
            </ReactFlow>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Selected Node Details */}
          <AnimatePresence mode="wait">
            {selectedNode ? (
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass-card rounded-xl border border-white/5 p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyber-cyan" />
                    Agent Details
                  </h3>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-muted-foreground hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Agent</p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedNode.data.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: getAgentStatusColor(
                            selectedNode.data.status,
                          ),
                          boxShadow: `0 0 6px ${getAgentStatusColor(selectedNode.data.status)}`,
                        }}
                      />
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color: getAgentStatusColor(selectedNode.data.status),
                        }}
                      >
                        {selectedNode.data.status}
                      </span>
                    </div>
                  </div>
                  {selectedNode.data.tokens && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Tokens Used
                      </p>
                      <p className="text-sm font-mono text-foreground">
                        {selectedNode.data.tokens}
                      </p>
                    </div>
                  )}
                  {selectedNode.data.findings !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Findings</p>
                      <p className="text-sm font-mono text-cyber-red">
                        {selectedNode.data.findings} detected
                      </p>
                    </div>
                  )}
                </div>

                <button className="w-full mt-4 py-2 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan text-xs font-semibold hover:bg-cyber-cyan/20 transition-all flex items-center justify-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  View Trace Log
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card rounded-xl border border-white/5 p-4"
              >
                <div className="text-center py-6">
                  <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-muted-foreground">
                    Click on an agent node to view details
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Agent Legend */}
          <div className="glass-card rounded-xl border border-white/5 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyber-cyan" />
              Legend
            </h3>
            <div className="space-y-2">
              {(
                [
                  { status: "ACTIVE", label: "Active" },
                  { status: "IDLE", label: "Idle" },
                  { status: "COMPLETED", label: "Completed" },
                  { status: "ERROR", label: "Error" },
                ] as const
              ).map(({ status, label }) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: getAgentStatusColor(status),
                      boxShadow: `0 0 4px ${getAgentStatusColor(status)}`,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Panel */}
      <AnimatePresence>
        {showTerminal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 300 }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl border border-white/5 overflow-hidden"
          >
            <AgentTerminal
              onClose={() => setShowTerminal(false)}
              logs={consoleLines}
              scanId={activeScan?.id ?? null}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Agent Terminal Component
function AgentTerminal({
  onClose,
  logs,
  scanId,
}: {
  onClose: () => void;
  logs: AgentConsoleLine[];
  scanId: string | null;
}) {
  const toClock = (timestamp?: string) => {
    if (!timestamp) return "--:--:--";
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? "--:--:--"
      : date.toLocaleTimeString();
  };

  const toColor = (status?: "success" | "error") =>
    status === "error" ? "#ff3366" : "#00ff88";

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyber-emerald" />
          <span className="text-sm font-semibold text-foreground font-mono">
            Agent Trace — {scanId ? `Scan #${scanId}` : "Recent Activity"}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1"
        style={{ background: "rgba(2, 4, 8, 0.9)" }}
      >
        {logs.map((line, i) => (
          <motion.div
            key={`${line.id}-${i}`}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className="flex items-start gap-3"
          >
            <span className="text-muted-foreground flex-shrink-0 select-none">
              {toClock(line.timestamp)}
            </span>
            <span
              className="flex-shrink-0 font-bold w-20"
              style={{ color: toColor(line.status) }}
            >
              [{line.agent}]
            </span>
            <span className="text-gray-300 leading-relaxed">{line.action}</span>
          </motion.div>
        ))}
        {logs.length === 0 && (
          <div className="text-muted-foreground">
            No live agent activity available yet.
          </div>
        )}
      </div>
    </div>
  );
}
