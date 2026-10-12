import importlib.util
import json
import sys
import types
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
import bcrypt
import mongomock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
api = sys.modules.setdefault('src.api', types.ModuleType('src.api')); api.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/api')]
from src.api.view.companion_view import CompanionGate, CompanionService, CompanionChatService
from src.agents.orchestrator_agent import orchestrator
from test_agent_flow import ScriptedClient, tool

class CompanionTest(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        db_module = types.ModuleType('src.db'); db_module.get_db = lambda: self.db
        path = Path(__file__).resolve().parents[1] / 'src/api/repositories/mongo/companion_repository.py'
        spec = importlib.util.spec_from_file_location('companion_fixture_repository', path); module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'src.db': db_module}): spec.loader.exec_module(module)
        self.repo_class = module.CompanionRepository
        self.repo = self.repo_class('user-a'); self.client = Mock()
        self.service = CompanionService(self.repo, self.client)
    def attributes(self): return {'name': 'Mira', 'age': '24', 'personality': 'Warm and witty', 'relationship': 'Girlfriend', 'height': '165 cm', 'body_type': 'Athletic', 'favourite_music': 'Jazz'}
    def test_gate_checks_password_and_binds_unlock_to_login(self):
        password = 'world-fixture'
        gate = CompanionGate(bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode())
        with self.assertRaises(Exception): gate.unlock('auth-a', 'wrong')
        token = gate.unlock('auth-a', password); gate.require('auth-a', token)
        with self.assertRaises(Exception): gate.require('auth-b', token)
        token = gate.unlock('auth-a', password); gate.close(token)
        with self.assertRaises(Exception): gate.require('auth-a', token)
        token = gate.unlock('auth-a', password)
        gate.tokens[token] = ('auth-a', 0)
        with self.assertRaises(Exception): gate.require('auth-a', token)
    def test_gate_limits_failed_attempts(self):
        gate = CompanionGate(bcrypt.hashpw(b'fixture', bcrypt.gensalt(rounds=4)).decode())
        for _ in range(5):
            with self.assertRaises(Exception): gate.unlock('auth-a', 'wrong')
        try: gate.unlock('auth-a', 'fixture')
        except Exception as error: self.assertEqual(error.status_code, 429)
        else: self.fail('Expected rate limit')
    def test_extract_preserves_extra_details_and_asks_for_missing_fields(self):
        attrs = [{'key': 'name', 'value': 'Mira'}, {'key': 'height', 'value': '165 cm'}, {'key': 'favourite_music', 'value': 'Jazz'}]
        self.client.call_api.return_value = {'choices': [{'message': {'tool_calls': [{'function': {'name': 'submit_profile', 'arguments': json.dumps({'attributes': attrs})}}]}}]}
        result = self.service.extract('Mira is 165 cm tall and loves jazz.', 'selected-model')
        self.assertEqual(result['attributes']['favourite_music'], 'Jazz')
        self.assertEqual(result['missing_fields'], ['age', 'personality', 'relationship'])
        self.assertNotIn('age', result['attributes'])
        self.assertEqual(self.client.call_api.call_args.args[1]['model'], 'selected-model')
        self.assertNotIn('password', str(self.client.call_api.call_args))
    def test_required_details_adult_age_and_extra_kv_survive_save(self):
        description = 'Original detail: she collects vintage postcards.'
        profile = self.service.save(self.attributes(), description)
        restored = self.service.get(profile['id'])
        self.assertEqual(restored['description'], description)
        self.assertEqual(restored['attributes']['body_type'], 'Athletic')
        self.assertEqual(restored['attributes']['favourite_music'], 'Jazz')
        for attrs in [{**self.attributes(), 'age': '17'}, {**self.attributes(), 'personality': ''}]:
            with self.assertRaises(Exception): self.service.save(attrs, description)
        edited = {**self.attributes(), 'name': 'Riya', 'height': '168 cm'}
        self.service.save(edited, description, profile['id'])
        self.assertEqual(len(self.repo.list()), 1)
        self.assertIn('Riya', self.service.get_prompt(profile['id']))
    def test_storage_and_profile_tools_are_isolated(self):
        first = self.service.save(self.attributes(), 'Description')
        second = self.service.save({**self.attributes(), 'name': 'Riya'}, 'Other description')
        thread = self.repo.new_thread(first['id'])
        self.assertIsNone(self.repo.thread(thread, second['id']))
        other_user = self.repo_class('user-b')
        self.assertEqual(other_user.list(), []); self.assertIsNone(other_user.thread(thread))
        tools, dispatch = self.service.tools(thread)
        self.assertEqual(dispatch['read_companion_profile']('height')['text'], '165 cm')
        self.assertEqual(dispatch['read_companion_profile']('original_description')['text'], 'Description')
        self.assertEqual(self.db.conversations.count_documents({}), 0)
    def test_private_chat_streams_and_restores_context_after_restart(self):
        profile = self.service.save(self.attributes(), 'She likes postcards.')
        thread = self.repo.new_thread(profile['id'])
        agent = orchestrator(); agent.llm_client = ScriptedClient([[{'content': 'Hi, I am Mira.'}]])
        chat = CompanionChatService(agent, self.service, types.SimpleNamespace(broadcast=lambda *_: None))
        _, stream = chat.handle_message(thread, 'Hello Mira', profile['id'], 'selected-model'); list(stream)
        chat._sessions[thread].worker.join(timeout=2)
        saved = self.repo.thread(thread)
        self.assertEqual([t['text'] for t in saved['turns']], ['Hello Mira', 'Hi, I am Mira.'])
        self.assertEqual(self.db.conversations.count_documents({}), 0)
        second_agent = orchestrator(); second_agent.llm_client = ScriptedClient([[{'accumulated_tool_calls': [tool('search_current_chat', {'query': 'hello'}, 'recall')]}], [{'content': 'I remember your hello.'}]])
        resumed = CompanionChatService(second_agent, self.service, types.SimpleNamespace(broadcast=lambda *_: None))
        _, stream = resumed.handle_message(thread, 'Continue our conversation', profile['id'], 'selected-model'); list(stream)
        resumed._sessions[thread].worker.join(timeout=2)
        self.assertIn('Hello Mira', str(second_agent.llm_client.calls[0]['messages']))
        self.assertEqual(resumed._sessions[thread].result_holder['result']['status'], 'done')
        self.repo.delete(profile['id'])
        self.assertIsNone(self.repo.thread(thread))
    def test_paused_question_is_saved_with_valid_restorable_context(self):
        profile = self.service.save(self.attributes(), 'Description')
        thread = self.repo.new_thread(profile['id'])
        messages = [{'role': 'system', 'content': 'Instructions'}, {'role': 'user', 'content': 'Plan something'}, {'role': 'assistant', 'content': None, 'tool_calls': [tool('ask_user', {'question': 'Which day?'}, 'ask')]}]
        self.repo.save_thread(thread, messages, question='Which day?')
        saved = self.repo.thread(thread)
        self.assertEqual(saved['turns'][-1]['text'], 'Which day?')
        self.assertFalse(any(m.get('tool_calls') for m in saved['context_messages']))
        self.assertEqual(saved['context_messages'][-1]['content'], 'Which day?')

    def test_routes_cannot_be_opened_without_both_gates_and_reject_wrong_profile_thread(self):
        from fastapi import FastAPI, Header, HTTPException
        from fastapi.testclient import TestClient
        def auth(authorization: str | None = Header(default=None)):
            if authorization != 'Bearer auth-a': raise HTTPException(401, 'Login required')
            return 'auth-a'
        gate = CompanionGate(bcrypt.hashpw(b'fixture', bcrypt.gensalt(rounds=4)).decode())
        deps = types.ModuleType('src.api.deps')
        deps.auth_service = types.SimpleNamespace(require_auth=auth)
        deps.companion_gate = gate; deps.companion_service = self.service; deps.companion_chat = Mock()
        path = Path(__file__).resolve().parents[1] / 'src/api/endpoint/companion.py'
        spec = importlib.util.spec_from_file_location('companion_fixture_endpoint', path); module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'src.api.deps': deps}): spec.loader.exec_module(module)
        app = FastAPI(); app.include_router(module.router); client = TestClient(app)
        self.assertEqual(client.get('/roleplay/profiles').status_code, 401)
        headers = {'Authorization': 'Bearer auth-a'}
        self.assertEqual(client.get('/roleplay/profiles', headers=headers).status_code, 403)
        unlock = client.post('/roleplay/unlock', headers=headers, json={'password': 'fixture'})
        headers['X-Roleplay-Token'] = unlock.json()['token']
        self.assertEqual(client.get('/roleplay/profiles', headers=headers).status_code, 200)
        created = client.post('/roleplay/profiles', headers=headers, json={'attributes': self.attributes(), 'description': 'Adult fictional companion.'})
        self.assertEqual(created.status_code, 200)
        profile_id = created.json()['id']
        foreign_thread = self.repo.new_thread('other-profile')
        self.assertEqual(client.post(f'/roleplay/profiles/{profile_id}/chat', headers=headers, json={'session_id': foreign_thread, 'message': 'Hello', 'model': 'selected'}).status_code, 404)
        self.assertEqual(client.put(f'/roleplay/profiles/{profile_id}', headers=headers, json={'attributes': {**self.attributes(), 'age': '16'}, 'description': 'Details'}).status_code, 400)
        client.post('/roleplay/lock', headers=headers)
        self.assertEqual(client.get('/roleplay/profiles', headers=headers).status_code, 403)

if __name__ == '__main__': unittest.main()
