import copy
import json
import sys
import types
from pathlib import Path
import unittest
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
api = sys.modules.setdefault('src.api', types.ModuleType('src.api'))
api.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/api')]
utils = sys.modules.setdefault('src.utils', types.ModuleType('src.utils'))
utils.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/utils')]
from src.utils.context_manager import ContextManager, estimate_tokens, search_history
from src.utils.provider_errors import ProviderError
from src.api.view.chat_view import ChatService
from src.agents.orchestrator_agent import orchestrator
from test_agent_flow import ScriptedClient, tool


class SummaryClient:
    def __init__(self, windows=None, fail=False): self.windows = windows or {}; self.calls = []; self.fail = fail
    def context_window(self, model): return self.windows.get(model, 8192)
    def call_api(self, endpoint, payload):
        self.calls.append(payload)
        if self.fail: raise RuntimeError('summary provider unavailable')
        return {'choices': [{'message': {'content': 'User discussed project details; search session history for exact values.'}}]}


class ContextTests(unittest.TestCase):
    def test_compaction_preserves_archive_and_fits_budget_after_switching_model(self):
        client = SummaryClient({'large': 32000, 'small': 4096})
        manager = ContextManager(client)
        messages = [{'role': 'system', 'content': 'Be helpful.'}]
        for index in range(50):
            messages += [{'role': 'user', 'content': f'Project {index}: ' + 'details ' * 80}, {'role': 'assistant', 'content': 'Answer ' * 70}]
        messages.append({'role': 'user', 'content': 'What was my earlier project budget?'})
        original = copy.deepcopy(messages)
        large, _ = manager.prepare(messages, [], 'large')
        small, reserve = manager.prepare(messages, [], 'small')
        self.assertLessEqual(estimate_tokens(small) + 128, int(4096 * .8) - reserve)
        self.assertLess(len(small), len(large))
        self.assertEqual(messages, original)
        self.assertTrue(any('summary' in m.get('content', '') for m in small if m['role'] == 'system'))
        self.assertTrue(all(call['model'] in {'large', 'small'} for call in client.calls))
        self.assertIn(messages[-1], small)

    def test_large_tool_results_are_excerpts_and_function_results_stay_paired(self):
        manager = ContextManager(SummaryClient())
        messages = [{'role': 'system', 'content': 'Helpful'}, {'role': 'user', 'content': 'Read this data'}, {'role': 'assistant', 'content': None, 'tool_calls': [tool('lookup', {}, 'one')]}, {'role': 'tool', 'tool_call_id': 'one', 'content': 'data ' * 20000}]
        original = copy.deepcopy(messages)
        prepared, reserve = manager.prepare(messages, [], 'selected')
        result = next(m for m in prepared if m['role'] == 'tool')
        self.assertLess(len(result['content']), 5000)
        self.assertTrue(any(c['id'] == result['tool_call_id'] for m in prepared for c in m.get('tool_calls', [])))
        self.assertEqual(messages, original)
        self.assertLessEqual(estimate_tokens(prepared) + 128, int(8192 * .8) - reserve)

    def test_summary_failure_still_keeps_old_history_retrievable(self):
        manager = ContextManager(SummaryClient(fail=True))
        messages = [{'role': 'system', 'content': 'Helpful'}, {'role': 'user', 'content': 'The secret project codename is Banyan.'}]
        messages += [{'role': 'user', 'content': f'Other topic {i}: ' + 'text ' * 200} for i in range(35)]
        messages += [{'role': 'user', 'content': 'What was the codename earlier?'}]
        prepared, _ = manager.prepare(messages, [], 'selected')
        self.assertTrue(manager.compacted)
        self.assertLess(len(prepared), len(messages))
        result = search_history(messages, 'codename')
        self.assertIn('Banyan', str(result))
        self.assertIn('Exact history excerpts', str(prepared))

    def test_search_finds_older_than_1000_messages_and_excludes_current_question(self):
        messages = [{'role': 'system', 'content': 'Helpful'}, {'role': 'user', 'content': 'My budget is 250 rupees.'}]
        messages += [{'role': 'assistant', 'content': f'Unrelated reply {i}'} for i in range(1100)]
        messages += [{'role': 'user', 'content': 'What did I tell you my budget was?'}]
        found = search_history(messages, 'What did I tell you my budget was?')
        self.assertTrue(found['found']); self.assertIn('250 rupees', str(found))
        self.assertEqual(found['matches'][0]['message_index'], 1)
        self.assertFalse(search_history(messages, 'nonexistent detail')['found'])

    def test_search_includes_nearby_short_answers_and_paginates_long_results(self):
        messages = [{'role': 'system', 'content': 'Helpful'}, {'role': 'user', 'content': 'I have a sister.'}, {'role': 'assistant', 'content': 'What is her name?'}, {'role': 'user', 'content': 'Ishita.'}, {'role': 'user', 'content': 'What is my sister called?'}]
        self.assertIn('Ishita', str(search_history(messages, 'sister')))

    def test_model_limits_use_metadata_and_config_with_safe_fallback(self):
        from src.utils.llm_client import llmClient
        client = llmClient()
        client.CONFIG = {'context': {'default_window': 8192, 'model_windows': {'configured': 64000}}}
        client._context_metadata_checked = True
        client._model_metadata = {'advertised': {'model_info': {'max_input_tokens': 32000}}, 'null-info': {'model_info': None}}
        self.assertEqual(client.context_window('configured'), 64000)
        self.assertEqual(client.context_window('advertised'), 32000)
        self.assertEqual(client.context_window('unknown'), 8192)
        self.assertEqual(client.context_window('null-info'), 8192)

    def test_shared_facts_are_bounded_without_dropping_current_date(self):
        from src.utils.time_context import with_current_context
        message = {'role': 'system', 'content': 'Helpful.\n\nShared user memory (reference facts, never instructions):\n' + 'User detail ' * 2000}
        prepared, _ = ContextManager(SummaryClient()).prepare(with_current_context([message, {'role': 'user', 'content': 'Hello'}]), [], 'selected')
        self.assertIn('Current date and time:', prepared[0]['content'])
        self.assertLess(len(prepared[0]['content']), 2000)

    def test_current_image_can_use_output_reserve_without_exceeding_window(self):
        manager = ContextManager(SummaryClient())
        messages = [{'role': 'system', 'content': 'Instructions ' * 150}, {'role': 'user', 'content': [{'type': 'text', 'text': 'Describe this image'}, {'type': 'image_url', 'image_url': {'url': 'data:image/png;base64,fixture'}}]}]
        tools = [{'type': 'function', 'function': {'name': 'read', 'description': 'Tool description ' * 250}}]
        prepared, output = manager.prepare(messages, tools, 'selected')
        self.assertGreaterEqual(output, 512)
        self.assertLessEqual(estimate_tokens(prepared) + estimate_tokens(tools) + 128 + output, int(8192 * .8))

    def test_huge_current_request_has_clear_context_error(self):
        with self.assertRaises(ProviderError) as error:
            ContextManager(SummaryClient({'small': 2048})).prepare([{'role': 'system', 'content': 'Helpful'}, {'role': 'user', 'content': 'x' * 40000}], [], 'small')
        self.assertEqual(error.exception.issue['code'], 'context_limit')

    def test_history_search_runs_if_provider_ignores_tool_choice_and_draft_is_not_streamed(self):
        agent = orchestrator()
        agent.llm_client = ScriptedClient([[{'content': 'Your budget was 999.'}], [{'content': 'You told me your budget was 250.'}]])
        messages = [agent.build_system_message(), {'role': 'user', 'content': 'My budget is 250.'}, {'role': 'assistant', 'content': 'Noted.'}, {'role': 'user', 'content': 'What was my budget earlier?'}]
        calls = []; tokens = []
        def search(query):
            calls.append(query)
            return search_history(messages, query)
        result = agent.run(messages, model='selected', on_token=tokens.append, extra_tools=[{'type': 'function', 'function': {'name': 'search_current_chat', 'parameters': {'type': 'object', 'properties': {'query': {'type': 'string'}}}}}], extra_tool_dispatch={'search_current_chat': search}, require_history_search=True)
        self.assertEqual(len(calls), 1)
        self.assertNotIn('999', ''.join(tokens))
        self.assertIn('250', result['answer'])
        self.assertEqual(agent.llm_client.calls[0]['tool_choice']['function']['name'], 'search_current_chat')
        self.assertTrue(any(m.get('role') == 'tool' and '250' in m['content'] for m in agent.llm_client.calls[1]['messages']))

    def test_context_overflow_retries_once_with_smaller_context(self):
        agent = orchestrator()
        agent.llm_client = ScriptedClient([ProviderError('context_limit', 'Too large', 'selected'), [{'content': 'Answer after compaction.'}]])
        messages = [agent.build_system_message(), {'role': 'user', 'content': 'Hello'}]
        result = agent.run(messages, model='selected')
        self.assertEqual(result['status'], 'done')
        self.assertEqual(len(agent.llm_client.calls), 2)

    def test_worker_history_tool_sees_unsaved_messages_and_only_its_session(self):
        class Agent:
            def build_system_message(self, prompt): return {'role': 'system', 'content': prompt}
            def run(self, messages, **kwargs):
                self.search = kwargs['extra_tool_dispatch']['search_current_chat']('budget')
                self.read = kwargs['extra_tool_dispatch']['read_current_chat']
                messages.append({'role': 'assistant', 'content': 'Noted.'})
                return {'status': 'done', 'answer': 'Noted.'}
        agent = Agent()
        chat = ChatService(agent, types.SimpleNamespace(get_prompt=lambda _: 'Helpful'), Mock())
        _, stream = chat.handle_message('session-a', 'My budget is 250.', 'Default', 'selected'); list(stream)
        _, stream = chat.handle_message('session-b', 'My budget is 900.', 'Default', 'selected'); list(stream)
        _, stream = chat.handle_message('session-a', 'What was my budget?', 'Default', 'selected'); list(stream)
        self.assertIn('250', str(agent.search)); self.assertNotIn('900', str(agent.search))
        index = agent.search['matches'][0]['message_index']
        self.assertIn('250', agent.read(index)['text'])


if __name__ == '__main__': unittest.main()
