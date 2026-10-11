import asyncio
from app.services.scan_service import ScanService

async def test():
    service = ScanService()
    try:
        scans = await service.list_scans(tenant_id='779f6fd9-f603-46e9-ab56-105891d12233', limit=10, offset=0)
        print(f'Found {len(scans)} scans')
        for s in scans:
            print(f'  Scan: {s.get("id")}, status: {s.get("status")}, medium_count: {s.get("medium_count")}, low_count: {s.get("low_count")}')
    except Exception as e:
        print(f'Error: {e}')

asyncio.run(test())