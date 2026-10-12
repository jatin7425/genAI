import importlib.util
import sys
import types
from pathlib import Path
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor

import mongomock


class ConversationIdentityTest(unittest.TestCase):
    def setUp(self):
        self.collection = mongomock.MongoClient().db.conversations
        path = Path(__file__).resolve().parents[1] / 'src/api/repositories/mongo/conversation_repository.py'
        spec = importlib.util.spec_from_file_location('identity_repository', path)
        module = importlib.util.module_from_spec(spec)
        db = types.ModuleType('src.db'); db.get_db = lambda: {'conversations': self.collection}
        with patch.dict(sys.modules, {'src.db': db}): spec.loader.exec_module(module)
        self.repository = module.MongoConversationRepository()

    def test_concurrent_first_saves_create_one_document(self):
        conversation = {'session_id': 'one-session', 'title': 'Hello', 'turns': [], 'updated_at': '2026-10-12'}
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda _: self.repository.upsert(conversation), range(30)))
        self.assertEqual(self.collection.count_documents({'session_id': 'one-session'}), 1)
        self.assertEqual(self.repository.list()['total'], 1)

    def test_legacy_duplicates_are_one_entry_with_consistent_history_title_and_deletion(self):
        for day in [1, 2]:
            self.collection.insert_one({'session_id': 'same-session', 'title': 'Same title', 'updated_at': f'2026-10-0{day}', 'turns': [{'text': str(day)}]})
        # A different session with the same title remains separate.
        self.collection.insert_one({'session_id': 'other-session', 'title': 'Same title', 'updated_at': '2026-10-03', 'turns': []})
        result = self.repository.list(limit=1)
        self.assertEqual(result['total'], 2)
        self.assertTrue(result['has_more'])
        self.assertEqual(result['items'][0]['session_id'], 'other-session')
        self.assertEqual(self.repository.list(skip=1, limit=1)['items'][0]['session_id'], 'same-session')
        self.assertEqual(self.repository.get_turns('same-session')['items'], [{'text': '2'}])
        self.repository.set_title('same-session', 'New AI title')
        self.assertEqual(self.repository.list(skip=1, limit=1)['items'][0]['title'], 'New AI title')
        self.assertTrue(self.repository.has_generated_title('same-session'))
        self.repository.delete('same-session')
        self.assertEqual(self.collection.count_documents({'session_id': 'same-session'}), 0)
        self.assertEqual(self.repository.list()['total'], 1)


if __name__ == '__main__': unittest.main()
