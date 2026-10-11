// src/lib/schemas.ts
// Centralized Zod schemas shared between forms and Next.js API route validation
import { z } from "zod";

// ─── Authentication ────────────────────────────────────────────────────────────

export const LoginFormSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export type LoginFormValues = z.infer<typeof LoginFormSchema>;

// ─── MFA ──────────────────────────────────────────────────────────────────────

export const MfaFormSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must contain only digits"),
});

export type MfaFormValues = z.infer<typeof MfaFormSchema>;

// ─── Projects ─────────────────────────────────────────────────────────────────

export const ProjectFormSchema = z.object({
  name: z
    .string()
    .min(2, "Project name must be at least 2 characters")
    .max(80, "Project name must be under 80 characters")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Only letters, numbers, spaces, hyphens, and underscores allowed"),
  repo_url: z
    .string()
    .min(1, "Repository URL is required")
    .url("Please enter a valid URL")
    .regex(
      /^https?:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/.+/,
      "Must be a GitHub, GitLab, or Bitbucket URL"
    ),
  description: z.string().max(500, "Description must be under 500 characters").optional(),
});

export type ProjectFormValues = z.infer<typeof ProjectFormSchema>;

// ─── Scans ────────────────────────────────────────────────────────────────────

const SCAN_TYPES = ["SAST", "DAST", "SCA", "SECRETS", "IaC"] as const;

export const ScanFormSchema = z.object({
  project_id: z.string().optional().or(z.literal("")),
  target_url: z
    .string()
    .optional()
    .or(z.literal("")),
  target_repo: z
    .string()
    .optional()
    .or(z.literal("")),
  branch: z
    .string()
    .max(100, "Branch name too long")
    .optional(),
  scan_types: z
    .array(z.string())
    .min(1, "Select at least one scan type"),
});

export type ScanFormValues = z.infer<typeof ScanFormSchema>;

// ─── Exploits ─────────────────────────────────────────────────────────────────

const EXPLOIT_TYPES = [
  "PROMPT_INJECTION",
  "JAILBREAK",
  "SQL_INJECTION",
  "XSS",
  "SSRF",
] as const;

const COMPLEXITY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const ExploitFormSchema = z.object({
  exploit_type: z.enum(EXPLOIT_TYPES, {
    error: () => ({ message: "Please select an exploit type" }),
  }),
  target_description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(1000, "Description must be under 1000 characters"),
  complexity: z.enum(COMPLEXITY_LEVELS, {
    error: () => ({ message: "Please select a complexity level" }),
  }),
  project_id: z.string().uuid("Invalid project selection"),
});

export type ExploitFormValues = z.infer<typeof ExploitFormSchema>;

// ─── Settings ─────────────────────────────────────────────────────────────────

export const ProfileFormSchema = z.object({
  display_name: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(60, "Display name too long"),
  email: z.string().email("Invalid email address"),
});

export type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

export const WebhookFormSchema = z.object({
  url: z.string().url("Please enter a valid webhook URL"),
  secret: z
    .string()
    .min(16, "Webhook secret must be at least 16 characters")
    .optional()
    .or(z.literal("")),
  events: z
    .array(z.string())
    .min(1, "Select at least one event to trigger the webhook"),
});

export type WebhookFormValues = z.infer<typeof WebhookFormSchema>;
