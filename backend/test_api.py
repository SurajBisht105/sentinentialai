import asyncio
from app.services.scan_service import ScanService

async def test():
    service = ScanService()
    scans = await service.list_scans(tenant_id='779f6fd9-f603-46e9-ab56-105891d12233', limit=10, offset=0)
    for scan in scans:
        # Simulate what the API does
        medium = scan.get('medium_count') or 0
        low = scan.get('low_count') or 0
        print(f'Scan: {scan["id"]}, medium_count: {medium}, low_count: {low}')

asyncio.run(test())