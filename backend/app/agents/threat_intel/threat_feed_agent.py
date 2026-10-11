# app/agents/threat_intel/threat_feed_agent.py
from typing import Dict, Any, List
import structlog
import asyncio
import httpx
from datetime import datetime, timedelta

from app.agents.base_agent import BaseAgent
from app.config import settings

logger = structlog.get_logger(__name__)


class ThreatFeedAgent(BaseAgent):
    """
    Threat Intelligence Feed Agent.

    Data Sources:
    - NVD (NIST National Vulnerability Database)
    - OSV (Open Source Vulnerabilities)
    - GitHub Security Advisories
    - CISA KEV (Known Exploited Vulnerabilities)

    Responsibilities:
    - Ingest and normalize threat feeds
    - Enrich findings with threat context
    - APT group correlation
    - Attack pattern mapping (MITRE ATT&CK)
    """

    AGENT_TYPE = "THREAT_INTEL"
    DEFAULT_MODEL = settings.LLM_MODEL_FAST

    NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    OSV_API = "https://api.osv.dev/v1"
    CISA_KEV_API = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = context["scan_id"]
        mode = context.get("mode", "ENRICH")  # ENRICH or INGEST

        if mode == "INGEST":
            return await self._ingest_feeds(context)
        else:
            return await self._enrich_findings(context)

    async def _ingest_feeds(self, context: Dict) -> Dict:
        """Ingest threat intelligence feeds into database"""
        self._add_reasoning_step(
            thought="Ingesting threat intelligence feeds from NVD, OSV, CISA",
            action="FEED_INGESTION_START",
        )

        results = await asyncio.gather(
            self._ingest_nvd(days_back=1),
            self._ingest_cisa_kev(),
            return_exceptions=True,
        )

        nvd_count = results[0] if isinstance(results[0], int) else 0
        kev_count = results[1] if isinstance(results[1], int) else 0

        self._add_reasoning_step(
            thought=f"Ingested {nvd_count} NVD CVEs and {kev_count} KEV entries",
            action="FEED_INGESTION_COMPLETE",
        )

        return {
            "scan_id": context.get("scan_id"),
            "status": "COMPLETED",
            "nvd_cves_ingested": nvd_count,
            "kev_entries_ingested": kev_count,
        }

    async def _ingest_nvd(self, days_back: int = 1) -> int:
        """Ingest recent CVEs from NVD API"""
        start_date = (datetime.utcnow() - timedelta(days=days_back)).strftime(
            "%Y-%m-%dT00:00:00.000"
        )
        end_date = datetime.utcnow().strftime("%Y-%m-%dT23:59:59.999")

        count = 0
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(
                    self.NVD_API,
                    params={
                        "pubStartDate": start_date,
                        "pubEndDate": end_date,
                        "resultsPerPage": 100,
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    vulnerabilities = data.get("vulnerabilities", [])

                    for vuln in vulnerabilities:
                        cve = vuln.get("cve", {})
                        await self._save_cve(cve)
                        count += 1

        except Exception as e:
            logger.error("nvd_ingest_failed", error=str(e))

        return count

    async def _save_cve(self, cve: Dict) -> None:
        """Save CVE to threat intel database"""
        cve_id = cve.get("id", "")
        if not cve_id:
            return

        descriptions = cve.get("descriptions", [])
        description = next(
            (d["value"] for d in descriptions if d.get("lang") == "en"), ""
        )

        # Extract CVSS v3 score
        metrics = cve.get("metrics", {})
        cvss_data = metrics.get("cvssMetricV31", [{}])[0]
        cvss_score = cvss_data.get("cvssData", {}).get("baseScore")

        # Determine severity
        severity = "INFO"
        if cvss_score:
            if cvss_score >= 9.0:
                severity = "CRITICAL"
            elif cvss_score >= 7.0:
                severity = "HIGH"
            elif cvss_score >= 4.0:
                severity = "MEDIUM"
            else:
                severity = "LOW"

        try:
            self.supabase.table("threat_intel_cve").upsert({
                "cve_id": cve_id,
                "severity": severity,
                "cvss_v3_score": cvss_score,
                "title": description[:500] if description else cve_id,
                "description": description,
                "published_date": cve.get("published", datetime.utcnow().isoformat()),
                "last_modified_date": cve.get("lastModified"),
                "source": "NVD",
                "last_checked_at": datetime.utcnow().isoformat(),
            }, on_conflict="cve_id").execute()
        except Exception as e:
            logger.debug("cve_save_error", cve_id=cve_id, error=str(e))

    async def _ingest_cisa_kev(self) -> int:
        """Ingest CISA Known Exploited Vulnerabilities catalog"""
        count = 0
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(self.CISA_KEV_API)

                if response.status_code == 200:
                    data = response.json()
                    vulnerabilities = data.get("vulnerabilities", [])

                    # Update KEV status for known exploited CVEs
                    for vuln in vulnerabilities[:100]:  # Process latest 100
                        cve_id = vuln.get("cveID")
                        if cve_id:
                            self.supabase.table("threat_intel_cve").update({
                                "kev_listed": True,
                                "exploited_in_wild": True,
                            }).eq("cve_id", cve_id).execute()
                            count += 1

        except Exception as e:
            logger.error("cisa_kev_ingest_failed", error=str(e))

        return count

    async def _enrich_findings(self, context: Dict) -> Dict:
        """Enrich security findings with threat intelligence"""
        scan_id = context["scan_id"]
        findings = context.get("findings", [])

        self._add_reasoning_step(
            thought=f"Enriching {len(findings)} findings with threat intelligence",
            action="THREAT_INTEL_ENRICHMENT",
        )

        enriched = []
        for finding in findings:
            enriched_finding = await self._enrich_finding(finding)
            enriched.append(enriched_finding)

        # Use LLM to provide APT correlation
        if findings:
            apt_correlation = await self._correlate_with_apt(findings)
        else:
            apt_correlation = {}

        return {
            "scan_id": scan_id,
            "status": "COMPLETED",
            "enriched_findings": len(enriched),
            "apt_correlation": apt_correlation,
        }

    async def _enrich_finding(self, finding: Dict) -> Dict:
        """Enrich a single finding with CVE and MITRE data"""
        cve_id = finding.get("cve_id")
        cwe_id = finding.get("cwe_id")

        enrichment = {}

        # Lookup CVE if available
        if cve_id:
            cve_data = self.supabase.table("threat_intel_cve").select(
                "cvss_v3_score, exploited_in_wild, kev_listed, patch_available"
            ).eq("cve_id", cve_id).single().execute()

            if cve_data.data:
                enrichment["cve_details"] = cve_data.data

        # Map CWE to MITRE ATT&CK
        if cwe_id:
            enrichment["mitre_techniques"] = self._map_cwe_to_mitre(cwe_id)

        return {**finding, "threat_intel": enrichment}

    def _map_cwe_to_mitre(self, cwe_id: str) -> List[str]:
        """Map CWE to MITRE ATT&CK technique IDs"""
        cwe_to_mitre = {
            "CWE-89": ["T1190", "T1505.003"],  # SQL Injection
            "CWE-79": ["T1190", "T1059.007"],  # XSS
            "CWE-798": ["T1552.001"],           # Hardcoded Credentials
            "CWE-312": ["T1552"],               # Cleartext Storage
            "CWE-918": ["T1090"],               # SSRF
            "CWE-22":  ["T1083", "T1005"],      # Path Traversal
            "CWE-78":  ["T1059"],               # OS Command Injection
        }
        return cwe_to_mitre.get(cwe_id, [])

    async def _correlate_with_apt(self, findings: List[Dict]) -> Dict:
        """Correlate findings with known APT tactics"""
        cwe_ids = list({f.get("cwe_id") for f in findings if f.get("cwe_id")})

        prompt = f"""
Correlate these vulnerability types with known APT tactics:

CWE IDs found: {cwe_ids}
Total findings: {len(findings)}
Critical findings: {sum(1 for f in findings if f.get('severity') == 'CRITICAL')}

Identify:
1. Which APT groups commonly exploit these vulnerability types?
2. What attack campaigns have used these techniques?
3. What is the likely attacker profile?

Respond with JSON:
{{
    "likely_apt_groups": ["APT-29", "..."],
    "attack_techniques": ["T1190", "..."],
    "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
    "attacker_profile": "description",
    "recommended_detections": ["detection1", "detection2"]
}}
"""
        response = await self.call_llm(prompt, json_mode=True)
        return await self.parse_json_response(response)