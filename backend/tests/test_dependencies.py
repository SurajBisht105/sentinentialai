import asyncio
import uuid
from unittest.mock import Mock, patch

from app.dependencies import get_tenant_id


def test_get_tenant_id_uses_profile_tenant():
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    profile_table = Mock()
    profile_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = Mock(
        data=[{"tenant_id": tenant_id}]
    )

    fake_supabase = Mock()
    fake_supabase.table.side_effect = lambda name: profile_table if name == "profiles" else None

    async def run_test():
        with patch("app.dependencies.get_supabase_client", return_value=fake_supabase):
            return await get_tenant_id({"id": user_id})

    assert asyncio.run(run_test()) == tenant_id


def test_get_tenant_id_creates_default_tenant_when_missing():
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    profile_table = Mock()
    profile_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = Mock(data=[])
    profile_table.insert.return_value.execute.return_value = Mock(data=[{"id": user_id}])
    profile_table.update.return_value.eq.return_value.execute.return_value = Mock(data=[{"id": user_id}])

    tenant_table = Mock()
    tenant_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = Mock(data=[])
    tenant_table.insert.return_value.execute.return_value = Mock(data=[{"id": tenant_id}])

    fake_supabase = Mock()
    fake_supabase.table.side_effect = lambda name: {
        "profiles": profile_table,
        "tenants": tenant_table,
    }.get(name)

    async def run_test():
        with patch("app.dependencies.get_supabase_client", return_value=fake_supabase):
            return await get_tenant_id({"id": user_id})

    assert asyncio.run(run_test()) == tenant_id
