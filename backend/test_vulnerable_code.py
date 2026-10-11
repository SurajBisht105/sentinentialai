#!/usr/bin/env python3
"""
Test script to verify vulnerability detection in SAST and DAST agents.
Creates a temporary vulnerable code repository and runs a scan.
"""

import asyncio
import os
import tempfile
import shutil
from pathlib import Path

# Vulnerable code samples for testing
VULNERABLE_PYTHON_CODE = '''
import os
import subprocess
import hashlib
import pickle
import yaml

# SQL Injection vulnerability
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
    return cursor.fetchone()

# Command Injection vulnerability
def ping_host(host):
    os.system(f"ping -c 4 {host}")

# Path Traversal vulnerability
def read_file(filename):
    with open(f"/var/www/uploads/{filename}", "r") as f:
        return f.read()

# Insecure Cryptography
def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()

# Insecure Deserialization
def load_data(data):
    return pickle.loads(data)

# Hardcoded Secret
API_KEY = "sk_test_FAKE_KEY_FOR_VULNERABILITY_TESTING"
JWT_SECRET = "my-super-secret-jwt-key-that-is-very-long"

# XSS vulnerability
def render_user_input(user_input):
    return f"<div>{user_input}</div>"
'''

VULNERABLE_JAVASCRIPT_CODE = '''
const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');

const app = express();

// SQL Injection
app.get('/users/:id', (req, res) => {
    const query = "SELECT * FROM users WHERE id = " + req.params.id;
    db.query(query, (err, result) => {
        res.json(result);
    });
});

// Command Injection
app.get('/ping', (req, res) => {
    exec(`ping -c 4 ${req.query.host}`, (error, stdout, stderr) => {
        res.send(stdout);
    });
});

// Path Traversal
app.get('/download', (req, res) => {
    const filePath = `/var/www/uploads/${req.query.file}`;
    res.download(filePath);
});

// Insecure Crypto
function hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');
}

// Hardcoded Secrets
const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const STRIPE_SECRET = "sk_test_FAKE_KEY_FOR_VULNERABILITY_TESTING";

// XSS
app.get('/search', (req, res) => {
    res.send(`<h1>Results for: ${req.query.q}</h1>`);
});

app.listen(3000);
'''

VULNERABLE_HTML = '''
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <script>
        // Exposed API key in client-side code
        const API_KEY = "AIzaSyB1234567890abcdefghijklmnopqrstuvwxyz";
        const STRIPE_KEY = "pk_live_abcdefghijklmnopqrstuvwxyz123456";
        
        // Insecure eval usage
        function processData(data) {
            return eval(data);
        }
    </script>
</head>
<body>
    <form action="/search" method="GET">
        <input type="text" name="q" value="">
        <input type="submit" value="Search">
    </form>
    
    <!-- Reflected XSS test -->
    <div id="results">
        Results for: <script>alert('xss')</script>
    </div>
</body>
</html>
'''

async def create_test_repo():
    """Create a temporary repository with vulnerable code"""
    temp_dir = tempfile.mkdtemp(prefix="sentinel-test-")
    repo_path = Path(temp_dir) / "vulnerable-app"
    repo_path.mkdir(parents=True)
    
    # Create Python vulnerable file
    (repo_path / "app.py").write_text(VULNERABLE_PYTHON_CODE)
    
    # Create JavaScript vulnerable file
    (repo_path / "server.js").write_text(VULNERABLE_JAVASCRIPT_CODE)
    
    # Create HTML file
    (repo_path / "index.html").write_text(VULNERABLE_HTML)
    
    # Create a requirements.txt
    (repo_path / "requirements.txt").write_text("flask==2.0.0\nrequests==2.25.0\npyyaml==5.4.0\n")
    
    # Create package.json
    (repo_path / "package.json").write_text('''{
    "name": "vulnerable-app",
    "version": "1.0.0",
    "dependencies": {
        "express": "^4.17.0",
        "lodash": "^4.17.15"
    }
}''')
    
    # Create .env file with secrets
    (repo_path / ".env").write_text('''
DATABASE_URL=postgresql://user:password@localhost/db
SECRET_KEY=super-secret-key-12345
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
''')
    
    print(f"Created test repository at: {repo_path}")
    return str(repo_path)

async def test_sast_scan(repo_path):
    """Test SAST agent directly"""
    print("\n=== Testing SAST Agent ===")
    
    from app.agents.sast_agent import SASTAgent
    from app.sandbox.executor import SandboxExecutor
    
    scan_id = "test-scan-" + str(asyncio.get_event_loop().time())
    
    async with SandboxExecutor() as executor:
        agent = SASTAgent()
        context = {
            "scan_id": scan_id,
            "repo_path": repo_path,
            "repo_url": repo_path,
            "branch": "main",
            "_executor": executor,
        }
        
        result = await agent.execute(context)
        print(f"SAST Result: {result.get('status')}")
        print(f"Findings: {len(result.get('findings', []))}")
        
        for finding in result.get('findings', []):
            print(f"  - [{finding.get('severity')}] {finding.get('title')} ({finding.get('cwe_id')})")
            print(f"    File: {finding.get('file_path')}:{finding.get('line_number')}")
        
        return result

async def test_dast_scan(target_url):
    """Test DAST agent directly"""
    print("\n=== Testing DAST Agent ===")
    
    from app.agents.defensive.dast_agent import DASTAgent
    
    scan_id = "test-dast-" + str(asyncio.get_event_loop().time())
    
    agent = DASTAgent()
    context = {
        "scan_id": scan_id,
        "target_url": target_url,
    }
    
    result = await agent.execute(context)
    print(f"DAST Result: {result.get('status')}")
    print(f"Findings: {result.get('findings_count', 0)}")
    
    for finding in agent.findings:
        print(f"  - [{finding.get('severity')}] {finding.get('title')} ({finding.get('cwe_id')})")
    
    return result

async def test_full_scan_service(repo_path):
    """Test the full scan service"""
    print("\n=== Testing Full Scan Service ===")
    
    from app.services.scan_service import ScanService
    
    service = ScanService()
    
    # Create a scan
    scan = await service.create_scan(
        repo_url=repo_path,
        branch="main",
        scan_types=["SAST", "SCA", "SECRETS", "IaC"],
        tenant_id="779f6fd9-f603-46e9-ab56-105891d12233",
    )
    
    scan_id = scan["id"]
    print(f"Created scan: {scan_id}")
    
    # Run the scan directly
    await service.run_direct_scan(scan, repo_path)
    
    # Check results
    from app.database.supabase import get_supabase_client
    supabase = get_supabase_client()
    
    findings = supabase.table("findings").select("*").eq("scan_id", scan_id).execute()
    print(f"Total findings in DB: {len(findings.data or [])}")
    
    for f in findings.data or []:
        print(f"  - [{f.get('severity')}] {f.get('title')} ({f.get('cwe_id')})")
        print(f"    Agent: {f.get('detecting_agent')}, File: {f.get('file_path')}:{f.get('line_number')}")
    
    return findings.data or []

async def main():
    print("Starting vulnerability detection tests...")
    
    # Create test repository
    repo_path = await create_test_repo()
    
    try:
        # Test SAST directly
        sast_result = await test_sast_scan(repo_path)
        
        # Test full scan service
        findings = await test_full_scan_service(repo_path)
        
        print("\n=== Summary ===")
        print(f"SAST Agent findings: {len(sast_result.get('findings', []))}")
        print(f"Full scan service findings: {len(findings)}")
        
        if len(findings) == 0 and len(sast_result.get('findings', [])) == 0:
            print("\n⚠️  NO VULNERABILITIES DETECTED - This indicates a problem!")
        else:
            print("\n✅ Vulnerabilities detected successfully!")
            
    finally:
        # Cleanup
        shutil.rmtree(os.path.dirname(repo_path), ignore_errors=True)
        print(f"\nCleaned up test repository")

if __name__ == "__main__":
    asyncio.run(main())