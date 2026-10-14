import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import mongomock
from fastapi import APIRouter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.migrations.remove_companions import COLLECTIONS, purge_retired_data


class RetiredDataCleanupTest(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        for name in COLLECTIONS:
            self.db[name].insert_one({'_id': 'retired', 'data': 'private data'})
        self.kept = ('conversations', 'personas', 'chat_attachments', 'user_memory', 'other_collection')
        for name in self.kept:
            self.db[name].insert_one({'_id': 'keep', 'data': 'original data'})

    def test_deletes_only_retired_collections_and_is_idempotent(self):
        self.assertEqual(purge_retired_data(self.db), list(COLLECTIONS))
        self.assertTrue(set(COLLECTIONS).isdisjoint(self.db.list_collection_names()))
        for name in self.kept:
            self.assertEqual(self.db[name].find_one(), {'_id': 'keep', 'data': 'original data'})
        self.assertEqual(purge_retired_data(self.db), [])
        self.assertEqual(set(self.db.list_collection_names()), set(self.kept))

    def test_failed_drop_is_reported_and_does_not_touch_other_data(self):
        with patch.object(self.db, 'drop_collection', side_effect=RuntimeError('drop denied')):
            with self.assertRaisesRegex(RuntimeError, 'drop denied'):
                purge_retired_data(self.db)
        self.assertEqual(self.db['user_memory'].count_documents({}), 1)

    def test_incomplete_cleanup_is_not_reported_as_success(self):
        with patch.object(self.db, 'drop_collection', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'did not finish'):
                purge_retired_data(self.db)

    def test_backend_startup_executes_cleanup_and_fails_if_database_denies_it(self):
        db_module = types.ModuleType('src.db'); db_module.get_db = lambda: self.db
        api_module = types.ModuleType('src.api'); api_module.api_router = APIRouter()
        path = Path(__file__).resolve().parents[1] / 'main.py'
        spec = importlib.util.spec_from_file_location('retirement_fixture_main', path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'src.db': db_module, 'src.api': api_module}):
            spec.loader.exec_module(module)
        async def start():
            async with module.app.router.lifespan_context(module.app):
                self.assertTrue(set(COLLECTIONS).isdisjoint(self.db.list_collection_names()))
        asyncio.run(start())
        self.db[COLLECTIONS[0]].insert_one({'_id': 'retired'})
        with patch.object(self.db, 'drop_collection', side_effect=RuntimeError('drop denied')):
            with self.assertRaisesRegex(RuntimeError, 'drop denied'):
                asyncio.run(start())


if __name__ == '__main__':
    unittest.main()
