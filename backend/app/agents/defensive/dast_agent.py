# app/agents/defensive/dast_agent.py
import asyncio
import re
from typing import Dict, Any, List, Optional
from urllib.parse import urljoin, urlparse
import httpx
import structlog

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class DASTAgent(BaseAgent):
    """
    Dynamic Application Security Testing & Live Website Vulnerability Agent.

    Capabilities:
    - Comprehensive HTTP security headers and policy auditing
    - Cookie security flags (Secure, HttpOnly, SameSite)
    - CORS misconfiguration detection
    - Server information disclosure & stack fingerprinting
    - Sensitive endpoint & debug file exposure (e.g., .env, .git/HEAD, Actuator, Swagger, phpinfo)
    - Client-side script and secret auditing in HTML & JS bundles
    - Safe runtime input reflection (XSS) and SQL error leakage probing
    - Open redirect detection
    - AI-driven vulnerability synthesis and copy-paste remediation generation
    """

    AGENT_TYPE = "DAST"
    DEFAULT_MODEL = settings.LLM_MODEL_REASONING

    SECURITY_HEADERS = {
        "Strict-Transport-Security": {
            "cwe": "CWE-319",
            "severity": "MEDIUM",
            "title": "Missing Strict-Transport-Security (HSTS) Header",
            "desc": "The application does not enforce HTTPS via the HSTS header, leaving users vulnerable to SSL-stripping and man-in-the-middle (MITM) attacks.",
            "remediation": "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' in web server response headers."
        },
        "Content-Security-Policy": {
            "cwe": "CWE-1021",
            "severity": "HIGH",
            "title": "Missing Content-Security-Policy (CSP) Header",
            "desc": "The Content-Security-Policy header is absent. CSP restricts the sources from which scripts, styles, and other resources can be loaded, mitigating XSS and data injection attacks.",
            "remediation": "Configure a strong Content-Security-Policy, e.g.: Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
        },
        "X-Frame-Options": {
            "cwe": "CWE-1021",
            "severity": "MEDIUM",
            "title": "Missing X-Frame-Options (Clickjacking Protection)",
            "desc": "The X-Frame-Options header is missing, allowing the website to be embedded in iframes on untrusted domains (Clickjacking).",
            "remediation": "Set 'X-Frame-Options: DENY' or 'X-Frame-Options: SAMEORIGIN' in web server headers."
        },
        "X-Content-Type-Options": {
            "cwe": "CWE-706",
            "severity": "LOW",
            "title": "Missing X-Content-Type-Options Header",
            "desc": "The X-Content-Type-Options header is missing. Browsers may MIME-sniff the response body, leading to script execution from non-script MIME types.",
            "remediation": "Add 'X-Content-Type-Options: nosniff' to all HTTP responses."
        },
        "Referrer-Policy": {
            "cwe": "CWE-200",
            "severity": "LOW",
            "title": "Missing Referrer-Policy Header",
            "desc": "The Referrer-Policy header is not configured, which can leak private query parameters and URLs in the Referer header to external destinations.",
            "remediation": "Set 'Referrer-Policy: strict-origin-when-cross-origin' in server headers."
        },
        "Permissions-Policy": {
            "cwe": "CWE-693",
            "severity": "LOW",
            "title": "Missing Permissions-Policy Header",
            "desc": "Permissions-Policy (Feature-Policy) is not set to restrict browser features such as camera, microphone, and geolocation.",
            "remediation": "Add 'Permissions-Policy: camera=(), microphone=(), geolocation=()' to server headers."
        },
    }

    SENSITIVE_FILES_PROBES = [
        {"path": "/.env", "indicators": ["DB_", "SECRET", "KEY=", "PASSWORD", "DATABASE_URL", "API_KEY"], "severity": "CRITICAL", "title": "Exposed Environment Variables File (.env)", "cwe": "CWE-552"},
        {"path": "/.env.local", "indicators": ["DB_", "SECRET", "KEY=", "PASSWORD", "DATABASE_URL"], "severity": "CRITICAL", "title": "Exposed Local Environment File (.env.local)", "cwe": "CWE-552"},
        {"path": "/.git/HEAD", "indicators": ["ref: refs/heads/"], "severity": "CRITICAL", "title": "Exposed Git Repository Metadata (/.git/HEAD)", "cwe": "CWE-538"},
        {"path": "/.git/config", "indicators": ["[core]", "repositoryformatversion"], "severity": "CRITICAL", "title": "Exposed Git Configuration (/.git/config)", "cwe": "CWE-538"},
        {"path": "/swagger.json", "indicators": ["swagger", "openapi", "paths"], "severity": "MEDIUM", "title": "Public Swagger API Definition Exposed (/swagger.json)", "cwe": "CWE-200"},
        {"path": "/openapi.json", "indicators": ["openapi", "paths", "info"], "severity": "MEDIUM", "title": "Public OpenAPI Specification Exposed (/openapi.json)", "cwe": "CWE-200"},
        {"path": "/actuator/health", "indicators": ["status", "UP", "DOWN"], "severity": "MEDIUM", "title": "Spring Boot Actuator Health Endpoint Exposed", "cwe": "CWE-200"},
        {"path": "/actuator/env", "indicators": ["propertySources", "activeProfiles"], "severity": "CRITICAL", "title": "Spring Boot Actuator Environment Dump Exposed", "cwe": "CWE-200"},
        {"path": "/phpinfo.php", "indicators": ["PHP Version", "Configuration File (php.ini) Path"], "severity": "HIGH", "title": "PHP Information Page Exposed (phpinfo.php)", "cwe": "CWE-200"},
        {"path": "/.DS_Store", "indicators": ["Bud1"], "severity": "LOW", "title": "MacOS .DS_Store Metadata File Exposed", "cwe": "CWE-538"},
        {"path": "/robots.txt", "indicators": ["User-agent:"], "severity": "INFO", "title": "Robots.txt Information Disclosure", "cwe": "CWE-200"},
    ]

    SECRET_REGEX_PATTERNS = [
        (r"AKIA[0-9A-Z]{16}", "CRITICAL", "Exposed AWS Access Key ID", "CWE-798"),
        (r"AIza[0-9A-Za-z\-_]{35}", "HIGH", "Exposed Google / Firebase API Key", "CWE-798"),
        (r"(?:sk_live|rk_live)_[0-9a-zA-Z]{24,}", "CRITICAL", "Exposed Stripe Live Secret Key", "CWE-798"),
        (r"ghp_[0-9a-zA-Z]{36}", "CRITICAL", "Exposed GitHub Personal Access Token", "CWE-798"),
        (r"github_pat_[0-9a-zA-Z_]{82}", "CRITICAL", "Exposed GitHub Fine-Grained Personal Access Token", "CWE-798"),
        (r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", "CRITICAL", "Exposed Private Cryptographic Key", "CWE-312"),
        (r"https://hooks\.slack\.com/services/T[0-9a-zA-Z_]+/B[0-9a-zA-Z_]+/[0-9a-zA-Z_]+", "HIGH", "Exposed Slack Webhook URL", "CWE-798"),
    ]

    SQL_ERROR_PATTERNS = [
        r"you have an error in your sql syntax",
        r"unclosed quotation mark after the character string",
        r"quoted string not properly terminated",
        r"pg::syntaxerror",
        r"sqlite3\.operationalerror",
        r"ora-01756",
        r"com\.mysql\.jdbc\.exceptions",
        r"org\.postgresql\.util\.psqlexception",
        r"microsoft ole db provider for sql server",
        r"sqlstate\[42",
    ]

    def get_system_prompt(self) -> str:
        return """You are SentinelAI DAST & Live Website Vulnerability Agent.
You perform dynamic application security testing, web vulnerability discovery, and security posture auditing.
You analyze runtime findings, verify evidence, calculate CVSS severity, and generate production-ready remediation code (e.g. NGINX, Apache, Express, FastAPI, Next.js)."""

    def _normalize_url(self, raw_url: str) -> str:
        url = raw_url.strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"
        return url.rstrip("/")

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        target_url = context.get("target_url") or context.get("repo_url")

        if not target_url:
            return {
                "scan_id": scan_id,
                "status": "SKIPPED",
                "reason": "No target URL provided for live website vulnerability scan",
            }

        target_url = self._normalize_url(target_url)

        self._add_reasoning_step(
            thought=f"Initiating live website security audit on {target_url}",
            action="DAST_SCAN_START",
            observation=f"Target URL: {target_url}",
        )

        results: Dict[str, Any] = {}

        # 1. Base Connectivity & Root Inspection
        self._add_reasoning_step(
            thought="Connecting to live target and inspecting response headers, cookies, and body",
            action="CHECK_BASE_ENDPOINT",
        )
        base_resp = await self._fetch_base_target(target_url)
        results["base_probe"] = {
            "status_code": base_resp.get("status_code"),
            "is_reachable": base_resp.get("reachable", False),
            "response_time_ms": base_resp.get("elapsed_ms"),
            "ssl_enabled": target_url.startswith("https://"),
        }

        if not base_resp.get("reachable"):
            # Try fallback to HTTP if HTTPS failed
            if target_url.startswith("https://"):
                fallback_url = "http://" + target_url[8:]
                self._add_reasoning_step(
                    thought=f"HTTPS connection failed, attempting fallback to {fallback_url}",
                    action="HTTP_FALLBACK_PROBE",
                )
                base_resp = await self._fetch_base_target(fallback_url)
                if base_resp.get("reachable"):
                    target_url = fallback_url
                    await self.report_finding(
                        scan_id=scan_id,
                        severity="HIGH",
                        title="Plaintext HTTP Enabled Without Forced HTTPS",
                        description=f"The application on {target_url} accepts unencrypted HTTP connections and failed to connect over HTTPS.",
                        cwe_id="CWE-319",
                        remediation="Configure web server to redirect all HTTP traffic to HTTPS (301 Permanent Redirect) and install a valid TLS certificate.",
                        file_path=target_url,
                        evidence={"protocol": "http", "status_code": base_resp.get("status_code")},
                        metadata={"endpoint": target_url, "category": "Transport Security"}
                    )

        if not base_resp.get("reachable"):
            self._add_reasoning_step(
                thought=f"Target {target_url} is completely unreachable or timed out",
                action="SCAN_FAILED_UNREACHABLE",
                observation=str(base_resp.get("error")),
            )
            return {
                "scan_id": scan_id,
                "target_url": target_url,
                "status": "FAILED",
                "reason": f"Target host {target_url} could not be reached: {base_resp.get('error')}",
                "findings_count": len(self.findings),
            }

        # 2. Security Headers & Cookie Audit
        self._add_reasoning_step(
            thought="Auditing HTTP security headers, CORS policies, and cookie attributes",
            action="AUDIT_HEADERS_AND_COOKIES",
        )
        headers_findings = await self._audit_headers_and_cookies(scan_id, target_url, base_resp)
        results["security_headers"] = headers_findings

        # 3. Server Information Disclosure & Stack Fingerprinting
        self._add_reasoning_step(
            thought="Auditing server banners, framework headers, and technology leaks",
            action="AUDIT_SERVER_INFO_DISCLOSURE",
        )
        tech_findings = await self._audit_tech_and_server_info(scan_id, target_url, base_resp)
        results["tech_disclosure"] = tech_findings

        # 4. Sensitive Exposed Files & Debug Endpoints
        self._add_reasoning_step(
            thought="Probing for exposed configuration files (.env, .git, Swagger, Actuator, phpinfo)",
            action="AUDIT_SENSITIVE_FILES",
        )
        file_findings = await self._audit_sensitive_endpoints(scan_id, target_url)
        results["sensitive_files"] = file_findings

        # 5. Client-Side Script & Secret Auditing
        self._add_reasoning_step(
            thought="Extracting and analyzing JavaScript bundles and HTML for exposed API keys and credentials",
            action="AUDIT_CLIENT_SCRIPTS",
        )
        script_findings = await self._audit_client_side_secrets(scan_id, target_url, base_resp.get("html", ""))
        results["client_secrets"] = script_findings

        # 6. Runtime Input & Injection Probing (XSS, SQLi, Open Redirect)
        self._add_reasoning_step(
            thought="Testing discovered parameters for reflected XSS, SQL error leakage, and open redirects",
            action="AUDIT_INPUT_INJECTIONS",
        )
        injection_findings = await self._audit_input_reflection_and_parameters(scan_id, target_url, base_resp.get("html", ""))
        results["injections"] = injection_findings

        # 7. Network Port Security & Exposed Service Discovery
        self._add_reasoning_step(
            thought="Scanning target host for exposed database, administration, and unencrypted service ports",
            action="AUDIT_OPEN_PORTS",
        )
        port_findings = await self._audit_open_ports(scan_id, target_url)
        results["open_ports"] = port_findings

        # 8. Authentication Bypass & Broken Access Control
        self._add_reasoning_step(
            thought="Auditing administrative routes, user management endpoints, and header authentication bypass heuristics",
            action="AUDIT_AUTH_BYPASS",
        )
        auth_findings = await self._audit_auth_bypass_and_admin_routes(scan_id, target_url)
        results["auth_bypass"] = auth_findings

        # 9. Remote Code Execution (RCE) & Template Injection
        self._add_reasoning_step(
            thought="Probing for Server-Side Template Injection (SSTI) and dynamic code evaluation in parameter inputs",
            action="AUDIT_RCE_INJECTION",
        )
        rce_findings = await self._audit_rce_and_command_injection(scan_id, target_url, base_resp.get("html", ""))
        results["rce_injections"] = rce_findings

        # 10. AI-Assisted Synthesis & Consensus Remediation
        self._add_reasoning_step(
            thought="Synthesizing discovered vulnerabilities and generating remediation roadmap with LLM",
            action="GENERATE_AI_REMEDIATION",
        )
        synthesis = await self._synthesize_findings(target_url, len(self.findings))
        results["ai_synthesis"] = synthesis

        return {
            "scan_id": scan_id,
            "target_url": target_url,
            "status": "COMPLETED",
            "findings_count": len(self.findings),
            "results": results,
            "ai_synthesis": synthesis,
        }

    async def _fetch_base_target(self, target_url: str) -> Dict[str, Any]:
        """Fetch the root page and capture full response metadata."""
        try:
            async with httpx.AsyncClient(
                verify=False,
                timeout=12.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinelAI-Auditor/1.0"}
            ) as client:
                import time
                t0 = time.time()
                resp = await client.get(target_url)
                elapsed_ms = int((time.time() - t0) * 1000)

                # Capture cookies
                cookies = []
                for header_val in resp.headers.get_list("set-cookie"):
                    cookies.append(header_val)

                return {
                    "reachable": True,
                    "status_code": resp.status_code,
                    "headers": dict(resp.headers),
                    "cookies": cookies,
                    "html": resp.text[:500000],  # up to 500KB
                    "final_url": str(resp.url),
                    "elapsed_ms": elapsed_ms,
                }
        except Exception as exc:
            logger.warning("target_fetch_failed", url=target_url, error=str(exc))
            return {
                "reachable": False,
                "error": str(exc)
            }

    async def _audit_headers_and_cookies(self, scan_id: str, base_url: str, base_resp: Dict[str, Any]) -> List[Dict]:
        """Check all essential web security headers, CORS, and cookie security flags."""
        findings = []
        headers = {k.lower(): v for k, v in base_resp.get("headers", {}).items()}

        # 1. Missing Security Headers
        for header_name, config in self.SECURITY_HEADERS.items():
            h_key = header_name.lower()
            if h_key not in headers:
                # If site is HTTP only, HSTS doesn't apply directly as an error on HTTP, but still note it
                if header_name == "Strict-Transport-Security" and base_url.startswith("http://"):
                    continue

                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity=config["severity"],
                    title=config["title"],
                    description=config["desc"],
                    cwe_id=config["cwe"],
                    remediation=config["remediation"],
                    file_path=base_url,
                    evidence={"missing_header": header_name, "status_code": base_resp.get("status_code")},
                    metadata={"header": header_name, "category": "Security Headers", "url": base_url}
                )
                findings.append(finding)

        # 2. Check for weak Content-Security-Policy if present
        if "content-security-policy" in headers:
            csp_val = headers["content-security-policy"]
            if "'unsafe-inline'" in csp_val and "'nonce-" not in csp_val:
                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity="MEDIUM",
                    title="Weak Content-Security-Policy ('unsafe-inline' Detected)",
                    description="The Content-Security-Policy header contains 'unsafe-inline' without strict cryptographic nonces or hashes, weakening XSS mitigation.",
                    cwe_id="CWE-1021",
                    remediation="Refactor inline scripts to external bundles or use cryptographic nonces (e.g., 'nonce-random123') in script-src.",
                    file_path=base_url,
                    evidence={"csp": csp_val},
                    metadata={"category": "Security Headers", "url": base_url}
                )
                findings.append(finding)

        # 3. Check CORS Wildcard with Credentials
        acao = headers.get("access-control-allow-origin")
        acac = headers.get("access-control-allow-credentials")
        if acao == "*" and acac == "true":
            finding = await self.report_finding(
                scan_id=scan_id,
                severity="HIGH",
                title="Dangerous CORS Configuration (Wildcard Origin with Credentials)",
                description="The server returns 'Access-Control-Allow-Origin: *' along with 'Access-Control-Allow-Credentials: true', potentially exposing authenticated sessions to malicious third-party sites.",
                cwe_id="CWE-942",
                remediation="Specify explicit trusted origins instead of wildcard '*' when 'Access-Control-Allow-Credentials' is set to true.",
                file_path=base_url,
                evidence={"Access-Control-Allow-Origin": acao, "Access-Control-Allow-Credentials": acac},
                metadata={"category": "CORS", "url": base_url}
            )
            findings.append(finding)

        # 4. Cookie Security Attributes
        cookies = base_resp.get("cookies", [])
        for cookie_str in cookies:
            cookie_lower = cookie_str.lower()
            cookie_name = cookie_str.split("=")[0].strip() if "=" in cookie_str else "SessionCookie"

            # Check Secure flag
            if base_url.startswith("https://") and "secure" not in cookie_lower:
                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity="MEDIUM",
                    title=f"Insecure Cookie Missing 'Secure' Flag: {cookie_name}",
                    description=f"Cookie '{cookie_name}' is set without the 'Secure' attribute, allowing it to be transmitted over unencrypted HTTP connections.",
                    cwe_id="CWE-614",
                    remediation=f"Append '; Secure' when setting cookie '{cookie_name}'.",
                    file_path=base_url,
                    evidence={"cookie": cookie_str},
                    metadata={"cookie_name": cookie_name, "category": "Cookie Security"}
                )
                findings.append(finding)

            # Check HttpOnly flag
            if "httponly" not in cookie_lower:
                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity="LOW",
                    title=f"Cookie Missing 'HttpOnly' Flag: {cookie_name}",
                    description=f"Cookie '{cookie_name}' does not have the 'HttpOnly' flag, allowing client-side JavaScript (document.cookie) to read it, increasing XSS session theft risk.",
                    cwe_id="CWE-1004",
                    remediation=f"Append '; HttpOnly' when setting cookie '{cookie_name}'.",
                    file_path=base_url,
                    evidence={"cookie": cookie_str},
                    metadata={"cookie_name": cookie_name, "category": "Cookie Security"}
                )
                findings.append(finding)

            # Check SameSite flag
            if "samesite" not in cookie_lower:
                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity="LOW",
                    title=f"Cookie Missing 'SameSite' Attribute: {cookie_name}",
                    description=f"Cookie '{cookie_name}' lacks an explicit 'SameSite' attribute (Lax or Strict), which can increase exposure to Cross-Site Request Forgery (CSRF).",
                    cwe_id="CWE-1275",
                    remediation=f"Append '; SameSite=Lax' or '; SameSite=Strict' to cookie '{cookie_name}'.",
                    file_path=base_url,
                    evidence={"cookie": cookie_str},
                    metadata={"cookie_name": cookie_name, "category": "Cookie Security"}
                )
                findings.append(finding)

        return findings

    async def _audit_tech_and_server_info(self, scan_id: str, base_url: str, base_resp: Dict[str, Any]) -> List[Dict]:
        """Detect verbose server banners and technology disclosures."""
        findings = []
        headers = {k.lower(): v for k, v in base_resp.get("headers", {}).items()}

        # Check Server header
        server_banner = headers.get("server", "")
        if server_banner and re.search(r"[/0-9]", server_banner):
            finding = await self.report_finding(
                scan_id=scan_id,
                severity="LOW",
                title=f"Server Version Disclosure: {server_banner}",
                description=f"The web server exposes its detailed software name and version in the 'Server' header ({server_banner}). This assists adversaries in fingerprinting known CVEs.",
                cwe_id="CWE-200",
                remediation="Configure web server to suppress or genericize server tokens (e.g. 'server_tokens off;' in Nginx, 'ServerSignature Off' and 'ServerTokens Prod' in Apache).",
                file_path=base_url,
                evidence={"Server": server_banner},
                metadata={"server_header": server_banner, "category": "Information Disclosure"}
            )
            findings.append(finding)

        # Check X-Powered-By
        powered_by = headers.get("x-powered-by", "")
        if powered_by:
            finding = await self.report_finding(
                scan_id=scan_id,
                severity="LOW",
                title=f"Technology Stack Disclosure via X-Powered-By: {powered_by}",
                description=f"The application reveals underlying framework/runtime via 'X-Powered-By: {powered_by}'.",
                cwe_id="CWE-200",
                remediation="Disable 'X-Powered-By' header in framework settings (e.g. 'app.disable(\"x-powered-by\")' in Express, 'expose_php = Off' in php.ini).",
                file_path=base_url,
                evidence={"X-Powered-By": powered_by},
                metadata={"powered_by": powered_by, "category": "Information Disclosure"}
            )
            findings.append(finding)

        # Check other banners
        for h_key in ["x-aspnet-version", "x-aspnetmvc-version", "x-generator"]:
            if h_key in headers:
                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity="LOW",
                    title=f"Framework Version Disclosure: {h_key}",
                    description=f"Header '{h_key}' exposes version details: {headers[h_key]}.",
                    cwe_id="CWE-200",
                    remediation=f"Remove '{h_key}' header from HTTP responses.",
                    file_path=base_url,
                    evidence={h_key: headers[h_key]},
                    metadata={"category": "Information Disclosure"}
                )
                findings.append(finding)

        return findings

    async def _audit_sensitive_endpoints(self, scan_id: str, base_url: str) -> List[Dict]:
        """Safely probe for exposed sensitive files and debug endpoints."""
        findings = []

        async with httpx.AsyncClient(
            verify=False,
            timeout=6.0,
            follow_redirects=False,
            headers={"User-Agent": "SentinelAI-Auditor/1.0"}
        ) as client:
            tasks = []
            for probe in self.SENSITIVE_FILES_PROBES:
                target_path = urljoin(base_url.rstrip("/") + "/", probe["path"].lstrip("/"))
                tasks.append(self._probe_single_file(client, target_path, probe))

            probe_results = await asyncio.gather(*tasks, return_exceptions=True)

            for res in probe_results:
                if isinstance(res, dict) and res.get("found"):
                    probe = res["probe"]
                    finding = await self.report_finding(
                        scan_id=scan_id,
                        severity=probe["severity"],
                        title=probe["title"],
                        description=f"Publicly accessible sensitive endpoint detected at {res['url']}. Response matched signature indicators: {', '.join(res['matched_indicators'])}.",
                        cwe_id=probe["cwe"],
                        remediation=f"Restrict public access to '{probe['path']}' in web server configuration or remove the file from public document root.",
                        file_path=res["url"],
                        evidence={
                            "url": res["url"],
                            "status_code": res["status_code"],
                            "preview": res["preview"][:300],
                            "matched": res["matched_indicators"],
                        },
                        metadata={"path": probe["path"], "category": "Sensitive File Exposure"}
                    )
                    findings.append(finding)

        return findings

    async def _probe_single_file(self, client: httpx.AsyncClient, url: str, probe: Dict[str, Any]) -> Dict[str, Any]:
        """Execute safe GET request for a specific sensitive file probe."""
        try:
            resp = await client.get(url)
            if resp.status_code == 200 and len(resp.text) > 0:
                text_lower = resp.text.lower()
                matched = [ind for ind in probe["indicators"] if ind.lower() in text_lower]

                # Special case: robots.txt is standard, check if it contains sensitive Disallow paths
                if probe["path"] == "/robots.txt":
                    disallowed = re.findall(r"Disallow:\s*([^\r\n]+)", resp.text, re.IGNORECASE)
                    sensitive_disallows = [d for d in disallowed if any(s in d.lower() for s in ["admin", "secret", "private", "backup", "internal", "config", "api/v"])]
                    if sensitive_disallows:
                        return {
                            "found": True,
                            "url": url,
                            "status_code": resp.status_code,
                            "matched_indicators": sensitive_disallows[:5],
                            "preview": resp.text[:400],
                            "probe": {
                                "path": "/robots.txt",
                                "severity": "LOW",
                                "title": "Sensitive Administrative Routes Disclosed in robots.txt",
                                "cwe": "CWE-200"
                            }
                        }
                    return {"found": False}

                if matched:
                    return {
                        "found": True,
                        "url": url,
                        "status_code": resp.status_code,
                        "matched_indicators": matched,
                        "preview": resp.text[:400],
                        "probe": probe
                    }
        except Exception:
            pass

        return {"found": False}

    async def _audit_client_side_secrets(self, scan_id: str, base_url: str, html: str) -> List[Dict]:
        """Scan HTML and linked client JavaScript bundles for leaked secrets and API keys."""
        findings = []
        if not html:
            return findings

        # 1. Scan inline HTML
        for pattern, severity, title, cwe in self.SECRET_REGEX_PATTERNS:
            matches = re.findall(pattern, html)
            if matches:
                sample = str(matches[0])
                masked = sample[:4] + "*" * (len(sample) - 8) + sample[-4:] if len(sample) > 8 else "***"
                finding = await self.report_finding(
                    scan_id=scan_id,
                    severity=severity,
                    title=f"{title} in HTML Source",
                    description=f"A potential sensitive credential or API key ({title}) was discovered directly exposed in the client HTML source code.",
                    cwe_id=cwe,
                    remediation="Remove hardcoded credentials from frontend source code. Use environment variables on the backend and proxy authenticated requests.",
                    file_path=base_url,
                    evidence={"credential_type": title, "masked_token": masked},
                    metadata={"category": "Exposed Secrets", "url": base_url}
                )
                findings.append(finding)

        # 2. Extract script URLs from HTML
        script_srcs = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
        internal_scripts = []
        base_domain = urlparse(base_url).netloc

        for src in script_srcs:
            full_script_url = urljoin(base_url, src)
            parsed_src = urlparse(full_script_url)
            # Only scan same origin or relative scripts
            if parsed_src.netloc == base_domain or not parsed_src.netloc:
                internal_scripts.append(full_script_url)

        # Scan up to top 5 JS bundles
        async with httpx.AsyncClient(
            verify=False,
            timeout=8.0,
            follow_redirects=True,
            headers={"User-Agent": "SentinelAI-Auditor/1.0"}
        ) as client:
            for script_url in internal_scripts[:5]:
                try:
                    resp = await client.get(script_url)
                    if resp.status_code == 200:
                        js_text = resp.text
                        for pattern, severity, title, cwe in self.SECRET_REGEX_PATTERNS:
                            matches = re.findall(pattern, js_text)
                            if matches:
                                sample = str(matches[0])
                                masked = sample[:4] + "*" * (len(sample) - 8) + sample[-4:] if len(sample) > 8 else "***"
                                finding = await self.report_finding(
                                    scan_id=scan_id,
                                    severity=severity,
                                    title=f"{title} in JavaScript Bundle",
                                    description=f"A sensitive key/credential ({title}) was discovered embedded inside client-side JavaScript asset: {script_url}.",
                                    cwe_id=cwe,
                                    remediation="Do not bake secret keys or tokens into frontend webpack/vite bundles. Migrate sensitive API calls to a secure backend API.",
                                    file_path=script_url,
                                    evidence={"script_url": script_url, "masked_token": masked},
                                    metadata={"script_url": script_url, "category": "Exposed Secrets"}
                                )
                                findings.append(finding)
                except Exception as js_err:
                    logger.debug("script_fetch_error", script=script_url, error=str(js_err))

        return findings

    async def _audit_input_reflection_and_parameters(self, scan_id: str, base_url: str, html: str) -> List[Dict]:
        """Perform safe input reflection and runtime injection error probing."""
        findings = []

        # Find input forms or search parameters in HTML
        form_actions = re.findall(r'<form[^>]+action=["\']([^"\']*)["\']', html, re.IGNORECASE)
        test_endpoints = [base_url]
        for action in form_actions[:3]:
            test_endpoints.append(urljoin(base_url, action))

        canary_token = "SentinelSafeXSS" + "789"
        probe_str = f'"{canary_token}><test>'

        async with httpx.AsyncClient(
            verify=False,
            timeout=8.0,
            follow_redirects=False,
            headers={"User-Agent": "SentinelAI-Auditor/1.0"}
        ) as client:
            # 1. Test Reflected XSS Canary
            for ep in test_endpoints[:2]:
                for param in ["q", "search", "query", "id", "keyword"]:
                    try:
                        test_url = f"{ep}{'&' if '?' in ep else '?'}{param}={probe_str}"
                        resp = await client.get(test_url)
                        if probe_str in resp.text:
                            finding = await self.report_finding(
                                scan_id=scan_id,
                                severity="HIGH",
                                title=f"Reflected XSS Vulnerability in Parameter '{param}'",
                                description=f"The endpoint {ep} reflected unescaped HTML characters ('<', '>', '\"') supplied via parameter '{param}'. This allows attackers to execute arbitrary client-side JavaScript.",
                                cwe_id="CWE-79",
                                remediation=f"Sanitize and HTML-encode all user-controllable input for '{param}' before rendering it in response HTML.",
                                file_path=ep,
                                evidence={"parameter": param, "url": test_url, "reflected": True},
                                metadata={"parameter": param, "category": "Injection", "url": test_url}
                            )
                            findings.append(finding)
                            break
                    except Exception:
                        pass

            # 2. Test Open Redirect
            for param in ["redirect", "next", "url", "return_to", "target", "dest"]:
                try:
                    test_redirect_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}=https://example.com"
                    resp = await client.get(test_redirect_url)
                    loc = resp.headers.get("location", "")
                    if resp.status_code in [301, 302, 303, 307, 308] and ("example.com" in loc):
                        finding = await self.report_finding(
                            scan_id=scan_id,
                            severity="HIGH",
                            title=f"Open Redirect Vulnerability via '{param}'",
                            description=f"The parameter '{param}' redirects users to arbitrary external URLs ({loc}) without domain validation, enabling phishing and OAuth token theft.",
                            cwe_id="CWE-601",
                            remediation="Implement strict domain whitelisting or relative-path verification before redirecting users.",
                            file_path=base_url,
                            evidence={"parameter": param, "redirect_location": loc, "status_code": resp.status_code},
                            metadata={"parameter": param, "category": "Open Redirect", "url": base_url}
                        )
                        findings.append(finding)
                        break
                except Exception:
                    pass

            # 3. Test SQL Syntax Error Leakage
            for param in ["id", "user", "item", "page"]:
                try:
                    test_sqli_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}=1%27"
                    resp = await client.get(test_sqli_url)
                    resp_text_lower = resp.text.lower()
                    for err_pat in self.SQL_ERROR_PATTERNS:
                        if re.search(err_pat, resp_text_lower):
                            finding = await self.report_finding(
                                scan_id=scan_id,
                                severity="CRITICAL",
                                title=f"SQL Database Error Leakage in Parameter '{param}'",
                                description=f"The application returned raw database error messages when handling unusual input for parameter '{param}'. This indicates missing query parameterization and potential SQL Injection.",
                                cwe_id="CWE-89",
                                remediation="Use parameterized prepared statements or an ORM for all database operations, and disable detailed database error messages in production.",
                                file_path=base_url,
                                evidence={"parameter": param, "sql_error_detected": err_pat, "url": test_sqli_url},
                                metadata={"parameter": param, "category": "SQL Injection", "url": test_sqli_url}
                            )
                            findings.append(finding)
                            break
                except Exception:
                    pass

        return findings

    async def _audit_open_ports(self, scan_id: str, target_url: str) -> List[Dict]:
        """Perform fast non-intrusive TCP port scan on common web, admin, and database service ports."""
        findings = []
        try:
            parsed = urlparse(target_url)
            hostname = parsed.hostname
            if not hostname:
                return findings

            # Standard service ports to audit
            PROBE_PORTS = [
                (21, "FTP", "HIGH", "Exposed Cleartext File Transfer Protocol (FTP) Port 21", "CWE-319", "Disable unencrypted FTP and use SFTP/SSH with key-based authentication."),
                (22, "SSH", "INFO", "Open SSH Management Service on Port 22", "CWE-200", "Ensure SSH uses strong key authentication and disable root password login."),
                (23, "Telnet", "CRITICAL", "Exposed Legacy Insecure Telnet Service on Port 23", "CWE-319", "Immediately shut down Telnet service; Telnet transmits credentials in plaintext."),
                (25, "SMTP", "LOW", "Exposed SMTP Mail Service on Port 25", "CWE-200", "Ensure SMTP relaying is disabled to prevent open spam relay abuse."),
                (3306, "MySQL", "HIGH", "Publicly Accessible MySQL Database Port 3306", "CWE-306", "Bind MySQL to localhost or internal VPC subnet only; block port 3306 on the public firewall."),
                (5432, "PostgreSQL", "HIGH", "Publicly Accessible PostgreSQL Database Port 5432", "CWE-306", "Restrict port 5432 on firewall and ensure listen_addresses is bound to private network interfaces."),
                (6379, "Redis", "CRITICAL", "Publicly Accessible Redis In-Memory Database Port 6379", "CWE-306", "Redis instances exposed to the internet can be trivially hijacked for RCE; bind to 127.0.0.1 and enable requirepass authentication."),
                (8080, "HTTP-Alt", "LOW", "Alternative HTTP Service Listening on Port 8080", "CWE-200", "Review services exposed on port 8080 to ensure they enforce standard TLS and authentication."),
                (8443, "HTTPS-Alt", "LOW", "Alternative HTTPS Service Listening on Port 8443", "CWE-200", "Ensure port 8443 administrative panels enforce multi-factor authentication."),
                (27017, "MongoDB", "CRITICAL", "Publicly Accessible MongoDB Database Port 27017", "CWE-306", "MongoDB exposed without firewall protection allows unauthorized database dumps; bind to internal IP and require authentication."),
                (9200, "Elasticsearch", "HIGH", "Publicly Accessible Elasticsearch REST API Port 9200", "CWE-306", "Elasticsearch exposed on port 9200 can allow full cluster data exfiltration without credentials; enable X-Pack security and restrict network access."),
            ]

            async def check_port(port_info):
                port, name, sev, title, cwe, remediation = port_info
                try:
                    conn = asyncio.open_connection(hostname, port)
                    reader, writer = await asyncio.wait_for(conn, timeout=1.5)
                    writer.close()
                    await writer.wait_closed()
                    return port_info
                except Exception:
                    return None

            results = await asyncio.gather(*[check_port(p) for p in PROBE_PORTS], return_exceptions=True)
            for res in results:
                if isinstance(res, tuple):
                    port, name, sev, title, cwe, remediation = res
                    finding = await self.report_finding(
                        scan_id=scan_id,
                        severity=sev,
                        title=title,
                        description=f"Port {port} ({name}) is actively accepting incoming TCP connections on host {hostname}. Public exposure of backend databases and administration services violates least-privilege perimeter security.",
                        cwe_id=cwe,
                        remediation=remediation,
                        file_path=f"{hostname}:{port}",
                        evidence={"hostname": hostname, "port": port, "service": name, "is_open": True},
                        metadata={"port": port, "service": name, "category": "Network & Port Security"}
                    )
                    findings.append(finding)
        except Exception as port_err:
            logger.debug("port_audit_error", error=str(port_err))

        return findings

    async def _audit_auth_bypass_and_admin_routes(self, scan_id: str, base_url: str) -> List[Dict]:
        """Probe for administrative consoles, unauthorized user endpoints, and HTTP header authentication bypasses."""
        findings = []
        ADMIN_PROBES = [
            "/admin", "/admin/login", "/administrator", "/admin/dashboard",
            "/api/admin", "/api/v1/admin", "/manage", "/console",
            "/api/v1/users", "/api/users", "/dashboard/admin",
        ]

        async with httpx.AsyncClient(
            verify=False,
            timeout=6.0,
            follow_redirects=False,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinelAI-Auditor/1.0"}
        ) as client:
            for path in ADMIN_PROBES:
                target_route = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
                try:
                    # 1. Standard Unauthenticated Request
                    resp = await client.get(target_route)
                    if resp.status_code == 200 and len(resp.text) > 100:
                        text_lower = resp.text.lower()
                        # Check if it returned a genuine admin dashboard or user data dump
                        if any(kw in text_lower for kw in ["dashboard", "admin console", "user management", "password_hash", "\"users\":", "\"email\":"]):
                            finding = await self.report_finding(
                                scan_id=scan_id,
                                severity="CRITICAL",
                                title=f"Unauthenticated Access to Administrative Endpoint ({path})",
                                description=f"The endpoint {target_route} is publicly accessible and returned administrative/user data without requiring authentication credentials (HTTP 200).",
                                cwe_id="CWE-306",
                                remediation=f"Enforce mandatory authentication checks on route '{path}' before processing requests.",
                                file_path=target_route,
                                evidence={"route": path, "status_code": resp.status_code, "preview": resp.text[:250]},
                                metadata={"route": path, "category": "Broken Access Control"}
                            )
                            findings.append(finding)
                            continue

                    # 2. Header-Based Auth Bypass Probe (X-Original-URL / X-Rewrite-URL / X-Forwarded-For)
                    if resp.status_code in [401, 403]:
                        bypass_headers = [
                            ("X-Original-URL", path),
                            ("X-Rewrite-URL", path),
                            ("X-Forwarded-For", "127.0.0.1"),
                            ("Client-IP", "127.0.0.1"),
                        ]
                        for h_name, h_val in bypass_headers:
                            bp_resp = await client.get(base_url, headers={h_name: h_val})
                            if bp_resp.status_code == 200 and len(bp_resp.text) > 200 and ("login" not in bp_resp.text.lower()):
                                finding = await self.report_finding(
                                    scan_id=scan_id,
                                    severity="CRITICAL",
                                    title=f"Authentication Bypass via Header '{h_name}' on {path}",
                                    description=f"Sending header '{h_name}: {h_val}' allowed bypassing 401/403 access control restrictions on endpoint {path}, returning full HTTP 200 OK access.",
                                    cwe_id="CWE-287",
                                    remediation=f"Configure reverse proxies to strip client-supplied '{h_name}' headers and enforce authentication in the application gateway.",
                                    file_path=target_route,
                                    evidence={"bypass_header": h_name, "value": h_val, "original_status": resp.status_code, "bypassed_status": bp_resp.status_code},
                                    metadata={"route": path, "header": h_name, "category": "Authentication Bypass"}
                                )
                                findings.append(finding)
                                break
                except Exception:
                    pass

        return findings

    async def _audit_rce_and_command_injection(self, scan_id: str, base_url: str, html: str) -> List[Dict]:
        """Safely probe query parameters and forms for Server-Side Template Injection (SSTI) and Command Injection."""
        findings = []
        test_params = ["cmd", "exec", "code", "eval", "view", "template", "file", "page", "query", "search", "name"]

        # Benign evaluation payload: ${7*7} or {{7*7}} evaluates to 49
        ssti_payloads = [
            ("${7*7}", "49", "Server-Side Template Injection (SSTI / Expression Evaluation)"),
            ("{{7*7}}", "49", "Jinja2 / Twig / Angular Template Injection (SSTI)"),
            ("<%= 7*7 %>", "49", "ERB / EJS Template Evaluation"),
        ]

        async with httpx.AsyncClient(
            verify=False,
            timeout=6.0,
            follow_redirects=False,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SentinelAI-Auditor/1.0"}
        ) as client:
            for param in test_params[:6]:
                for payload, expected_eval, title in ssti_payloads:
                    try:
                        probe_url = f"{base_url}{'&' if '?' in base_url else '?'}{param}={payload}"
                        resp = await client.get(probe_url)
                        if expected_eval in resp.text and payload not in resp.text:
                            finding = await self.report_finding(
                                scan_id=scan_id,
                                severity="CRITICAL",
                                title=f"Remote Code Execution / {title} in Parameter '{param}'",
                                description=f"Parameter '{param}' on {base_url} executed template expression '{payload}', returning evaluated arithmetic result '{expected_eval}'. This allows arbitrary remote code execution (RCE).",
                                cwe_id="CWE-94",
                                remediation="Never pass user-supplied input directly to template rendering engines. Use context sandboxing or static templates.",
                                file_path=base_url,
                                evidence={"parameter": param, "payload": payload, "evaluated_result": expected_eval, "url": probe_url},
                                metadata={"parameter": param, "category": "Remote Code Execution", "url": probe_url}
                            )
                            findings.append(finding)
                            break
                    except Exception:
                        pass

        return findings

    async def _synthesize_findings(self, target_url: str, count: int) -> Dict[str, Any]:
        """Use LLM to generate an executive risk summary and prioritized remediation roadmap."""
        findings_summary = [
            {
                "title": f.get("title"),
                "severity": f.get("severity"),
                "cwe": f.get("cwe_id"),
                "description": f.get("description", "")[:150]
            }
            for f in self.findings[:15]
        ]

        prompt = f"""
Analyze the security audit results for live target: {target_url}
Total findings detected: {count}

Findings:
{__import__('json').dumps(findings_summary, indent=2)}

Provide a concise security report in valid JSON format:
{{
    "overall_risk": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN",
    "executive_summary": "Short 2-3 sentence overview of security posture",
    "top_priorities": ["Priority action item 1", "Priority action item 2", "Priority action item 3"],
    "server_hardening_guide": "Recommended NGINX/Apache/Cloudflare configuration block"
}}
"""
        try:
            response = await asyncio.wait_for(
                self.call_llm(prompt, json_mode=True, model=settings.LLM_MODEL_FAST),
                timeout=25.0,
            )
            return await self.parse_json_response(response)
        except Exception as llm_err:
            logger.warning("llm_synthesis_fallback_used", error=str(llm_err))
            return {
                "overall_risk": "HIGH" if count > 3 else ("MEDIUM" if count > 0 else "CLEAN"),
                "executive_summary": f"Live security audit of {target_url} identified {count} findings.",
                "top_priorities": ["Remediate missing security headers", "Harden exposed administrative routes and ports", "Enforce input validation against injections"],
                "server_hardening_guide": "Add recommended security headers to web server config and restrict unused ports on firewall."
            }