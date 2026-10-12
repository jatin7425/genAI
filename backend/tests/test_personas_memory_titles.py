import importlib.util
import sys
import types
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

api = sys.modules.setdefault('src.api', types.ModuleType('src.api'))
api.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/api')]
from src.api.view.persona_view import PersonaService
from src.api.view.memory_view import MemoryService
from src.api.view.conversation_view import ConversationService


class MemoryRepository:
    def __init__(self): self.data = {}
    def list(self, user): return [{'key': k, 'value': v} for (u, k), v in self.data.items() if u == user]
    def set(self, user, key, value): self.data[user, key] = value
    def delete(self, user, key): self.data.pop((user, key), None)
    def clear(self, user): self.data = {k: v for k, v in self.data.items() if k[0] != user}


class FeatureTest(unittest.TestCase):
    def test_memory_persists_across_instances_and_is_scoped_to_user(self):
        repository = MemoryRepository()
        first = MemoryService(repository, 'jatin')
        first.set('language', 'Hindi')
        second = MemoryService(repository, 'jatin')
        self.assertIn('Hindi', second.context())
        self.assertEqual(MemoryService(repository, 'another-user').list(), [])
        second.set('language', 'English')
        self.assertEqual(first.list(), [{'key': 'language', 'value': 'English'}])
        first.delete('language')
        self.assertEqual(second.list(), [])
        for key, value in [('', 'text'), ('k', ' '), ('x' * 101, 'text')]:
            with self.assertRaises(ValueError): first.set(key, value)

    def test_persona_endpoint_loads_and_edits_existing_prompt_without_creating_missing_persona(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        class Personas:
            prompts = {'Default Assistant': 'Original prompt'}
            def get(self, name): return self.prompts.get(name)
            def update(self, name, prompt):
                if name not in self.prompts: return False
                self.prompts[name] = prompt
                return True
        deps = types.ModuleType('src.api.deps')
        deps.persona_service = PersonaService(Personas())
        path = Path(__file__).resolve().parents[1] / 'src/api/endpoint/persona.py'
        spec = importlib.util.spec_from_file_location('persona_fixture_endpoint', path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'src.api.deps': deps}): spec.loader.exec_module(module)
        app = FastAPI(); app.include_router(module.router)
        client = TestClient(app)
        self.assertEqual(client.get('/personas/Default%20Assistant').json()['prompt'], 'Original prompt')
        self.assertEqual(client.put('/personas/Default%20Assistant', json={'prompt': ' Updated prompt '}).status_code, 200)
        self.assertEqual(client.get('/personas/Default%20Assistant').json()['prompt'], 'Updated prompt')
        self.assertEqual(client.put('/personas/missing', json={'prompt': 'New prompt'}).status_code, 404)
        self.assertEqual(client.put('/personas/Default%20Assistant', json={'prompt': '   '}).status_code, 422)

    def test_chat_uses_edited_persona_and_shared_memory_without_crossing_sessions(self):
        from src.api.view.chat_view import ChatService
        prompts = {'Researcher': 'Original instructions'}
        memory = MemoryService(MemoryRepository(), 'jatin')
        class Agent:
            def __init__(self): self.calls = []
            def build_system_message(self, prompt): return {'role': 'system', 'content': prompt}
            def run(self, messages, **kwargs):
                self.calls.append([dict(m) for m in messages])
                if messages[-1]['content'] == 'Remember my language is Hindi':
                    kwargs['extra_tool_dispatch']['remember_user_detail']('language', 'Hindi')
                messages.append({'role': 'assistant', 'content': 'Done'})
                return {'status': 'done', 'answer': 'Done'}
        agent = Agent()
        chat = ChatService(agent, types.SimpleNamespace(get_prompt=prompts.get), Mock(), memory_service=memory)
        _, stream = chat.handle_message('session-a', 'Remember my language is Hindi', 'Researcher', 'selected-model'); list(stream)
        prompts['Researcher'] = 'Updated instructions'
        _, stream = chat.handle_message('session-a', 'Follow up A', 'Researcher', 'selected-model'); list(stream)
        self.assertIn('Updated instructions', agent.calls[-1][0]['content'])
        _, stream = chat.handle_message('session-b', 'A different question', 'Researcher', 'selected-model'); list(stream)
        self.assertIn('Hindi', agent.calls[-1][0]['content'])
        self.assertNotIn('Follow up A', str(agent.calls[-1]))
        memory.delete('language')
        _, stream = chat.handle_message('session-b', 'Continue B', 'Researcher', 'selected-model'); list(stream)
        self.assertNotIn('Hindi', agent.calls[-1][0]['content'])

    def test_title_uses_question_reply_and_selected_model_then_broadcasts(self):
        repository = Mock(); repository.set_title.return_value = True
        client = Mock(); client.call_api.return_value = {'choices': [{'message': {'content': 'Planning a Mumbai trip'}}]}
        broadcaster = Mock()
        service = ConversationService(repository, broadcaster, llm_client=client)
        service._generate_title('session-a', 'What can I do in Mumbai?', 'Visit the Gateway of India.', 'gemini-test')
        payload = client.call_api.call_args.args[1]
        self.assertEqual(payload['model'], 'gemini-test')
        self.assertIn('Gateway of India', payload['messages'][1]['content'])
        repository.set_title.assert_called_once_with('session-a', 'Planning a Mumbai trip')
        broadcaster.broadcast.assert_called_once_with('titled', {'session_id': 'session-a', 'title': 'Planning a Mumbai trip'})

    def test_no_title_for_partial_or_failed_reply_and_no_duplicate_generation(self):
        repository = Mock(); repository.has_generated_title.return_value = False
        service = ConversationService(repository, Mock(), llm_client=Mock())
        turns = [{'kind': 'user', 'text': 'Question'}, {'kind': 'agent', 'text': 'Partial', 'status': 'error'}]
        with patch('src.api.view.conversation_view.threading.Thread') as thread:
            service._schedule_title('session-a', turns, 'selected-model')
            thread.assert_not_called()
            turns[-1]['status'] = 'done'
            service._schedule_title('session-a', turns, 'selected-model')
            service._schedule_title('session-a', turns, 'selected-model')
            self.assertEqual(thread.call_count, 1)
        repository.has_generated_title.return_value = True
        with patch('src.api.view.conversation_view.threading.Thread') as thread:
            service._schedule_title('another-session', turns, 'selected-model')
            thread.assert_not_called()

    def test_session_memory_pagination_does_not_mix_sessions(self):
        repository = Mock()
        repository.get_turns.side_effect = [
            {'items': [{'text': 'recent'}], 'has_more': True},
            {'items': [{'text': 'old'}], 'has_more': False},
        ]
        service = ConversationService(repository, Mock())
        self.assertEqual([t['text'] for t in service.get_session_memory('session-a')['items']], ['old', 'recent'])
        self.assertTrue(all(call.args[0] == 'session-a' for call in repository.get_turns.call_args_list))

    def test_later_conversation_saves_preserve_generated_title(self):
        path = Path(__file__).resolve().parents[1] / 'src/api/repositories/mongo/conversation_repository.py'
        spec = importlib.util.spec_from_file_location('conversation_fixture_repository', path)
        module = importlib.util.module_from_spec(spec)
        db_module = types.ModuleType('src.db'); db_module.get_db = Mock()
        with patch.dict(sys.modules, {'src.db': db_module}): spec.loader.exec_module(module)
        collection = Mock()
        collection.find_one.return_value = {'_id': 'fixture', 'session_id': 'session-a', 'title': 'AI title', 'title_generated': True}
        repository = module.MongoConversationRepository.__new__(module.MongoConversationRepository)
        repository.collection = collection
        saved = repository.upsert({'session_id': 'session-a', 'title': 'Fallback text', 'turns': []})
        operation = collection.update_one.call_args.args[1]
        self.assertNotIn('title', operation['$set'])
        self.assertEqual(operation['$setOnInsert']['title'], 'Fallback text')
        self.assertEqual(saved['title'], 'AI title')
        collection.update_one.return_value.matched_count = 0
        self.assertFalse(repository.set_title('deleted-session', 'Generated title'))
        self.assertNotIn('upsert', collection.update_one.call_args.kwargs)

    def test_title_failure_does_not_fail_chat_or_leave_pending_generation(self):
        client = Mock(); client.call_api.side_effect = RuntimeError('provider limit')
        service = ConversationService(Mock(), Mock(), llm_client=client)
        service._pending_titles.add('session-a')
        service._generate_title('session-a', 'Question', 'Reply', 'selected-model')
        self.assertNotIn('session-a', service._pending_titles)
        service.repository.set_title.assert_not_called()


if __name__ == '__main__': unittest.main()
