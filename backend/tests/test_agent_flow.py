import importlib
import sys
import types
from pathlib import Path
import unittest
from unittest.mock import patch

api = sys.modules.setdefault('src.api', types.ModuleType('src.api'))
api.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/api')]
utils = sys.modules.setdefault('src.utils', types.ModuleType('src.utils'))
utils.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/utils')]
from src.utils.provider_errors import ProviderError
from src.api.view.chat_view import ChatService
from src.agents.orchestrator_agent import orchestrator


class ScriptedClient:
    def __init__(self, responses): self.responses = iter(responses); self.calls = []
    def call_api_stream(self, endpoint, payload):
        self.calls.append(payload)
        response = next(self.responses)
        if isinstance(response, Exception): raise response
        yield from response


def tool(name, args, key):
    import json
    return {'id':key,'type':'function','function':{'name':name,'arguments':json.dumps(args)}}


class AgentFlowTest(unittest.TestCase):
    def test_parent_delegates_selected_model_search_executes_and_final_answer_streams(self):
        agent = orchestrator()
        agent.llm_client = ScriptedClient([
            [{'accumulated_tool_calls':[tool('web_search_agent',{'query':'Find software companies'},'parent-call')]}],
            [{'content':'Verified final answer.'}],
        ])
        research = agent.agent_factory.web_search_agent
        research.llm_client = ScriptedClient([
            [{'reasoning_content':'Plan a search.'},{'content':'Internal research draft.'},{'accumulated_tool_calls':[tool('duckduckgo_search',{'query':'software companies Pune'},'search-call')]}],
            [{'accumulated_tool_calls':[tool('submit_answer',{'answer':'Found results','sources':['https://example.com'],'confidence':'high'},'answer-call')]}],
        ])
        research.web_search.read_page = lambda url, query='': {'status':'success','url':url,'title':'Source','text':'Relevant verified source text.'}
        searches = []; events = []; tokens = []
        research.web_search.duckduckgo_search = lambda query, max_results=10: searches.append(query) or [{'title':'Result','link':'https://example.com','snippet':'Relevant result'}]
        result = agent.run([agent.build_system_message(),{'role':'user','content':'Find companies'}], model='gemini-3.5-flash', on_event=lambda *args:events.append(args), on_token=tokens.append)
        self.assertEqual(result['answer'],'Verified final answer.')
        self.assertEqual(result['sources'],['https://example.com/'])
        self.assertEqual(searches,['software companies Pune'])
        self.assertTrue(all(call['model']=='gemini-3.5-flash' for call in research.llm_client.calls))
        self.assertIn('Searching the web…', str(events))
        self.assertNotIn('Plan a search.', ''.join(tokens))
        self.assertNotIn('Internal research draft.', ''.join(tokens))
        final_messages = agent.llm_client.calls[-1]['messages']
        self.assertTrue(any(message.get('role')=='tool' and message.get('tool_call_id')=='parent-call' for message in final_messages))

    def test_failed_delegated_provider_finishes_sse_and_repairs_pending_tool_messages(self):
        agent = orchestrator()
        agent.llm_client = ScriptedClient([[{'accumulated_tool_calls':[tool('web_search_agent',{'query':'Research'},'parent-call')]}]])
        agent.agent_factory.web_search_agent.llm_client = ScriptedClient([ProviderError('provider_limit','Limit reached.','gemini-3.5-flash',60)])
        broadcaster = types.SimpleNamespace(broadcast=lambda *_:None)
        chat = ChatService(agent,types.SimpleNamespace(get_prompt=lambda _:'Be helpful'),broadcaster)
        _, stream = chat.handle_message('fixture-chat','Research this','Default','gemini-3.5-flash')
        events = ''.join(stream)
        self.assertIn('event: done',events);self.assertIn('provider_limit',events)
        messages=chat._sessions['fixture-chat'].messages
        self.assertTrue(any(item.get('role')=='tool' and item.get('tool_call_id')=='parent-call' for item in messages))

    def test_empty_research_does_not_become_a_fabricated_parent_answer(self):
        agent = orchestrator()
        agent.llm_client = ScriptedClient([[{'accumulated_tool_calls':[tool('web_search_agent',{'query':'Research'},'research-call'),tool('other',{},'pending-call')]}]])
        agent.agent_factory.web_search_agent.web_search_agent = lambda **kwargs: {'answer':None,'sources':[],'confidence':'low','note':'Search providers are unavailable.'}
        messages=[agent.build_system_message(),{'role':'user','content':'Research this'}]
        result=agent.run(messages,model='selected')
        self.assertEqual(result['status'],'error'); self.assertEqual(result['provider_issue']['code'],'web_search_failed')
        self.assertEqual(len(agent.llm_client.calls),1)
        self.assertEqual({m['tool_call_id'] for m in messages if m.get('role')=='tool'},{'research-call','pending-call'})

    def test_attachment_in_clarification_is_added_after_tool_result(self):
        from test_chat_attachments import MemoryAttachments
        from src.api.view.attachment_view import AttachmentService
        attachments=AttachmentService(MemoryAttachments())
        agent=orchestrator()
        agent.llm_client=ScriptedClient([
            [{'accumulated_tool_calls':[tool('ask_user',{'question':'Attach your notes'},'ask-call')]}],
            [{'content':'I read your notes.'}],
        ])
        chat=ChatService(agent,types.SimpleNamespace(get_prompt=lambda _:'Be helpful'),types.SimpleNamespace(broadcast=lambda *_:None),attachment_service=attachments)
        with patch.dict('src.utils.common_tools.config', {'is_terminal': False}):
            _, first=chat.handle_message('clarification','Help me','Default','gemini-3.5-flash')
            self.assertIn('event: question',''.join(first))
            attachment=attachments.upload(b'Clarification fact: deadline is Friday.','notes.txt')
            _, second=chat.handle_message('clarification','Here are my notes','Default','gemini-3.5-flash',attachment_ids=[attachment['id']])
            self.assertIn('I read your notes',''.join(second))
        messages=agent.llm_client.calls[-1]['messages']
        tool_index=next(i for i,m in enumerate(messages) if m.get('tool_call_id')=='ask-call')
        context_index=next(i for i,m in enumerate(messages) if isinstance(m.get('content'),list))
        self.assertLess(tool_index,context_index)
        self.assertIn('deadline is Friday',str(messages[context_index]))

    def test_streamed_tool_deltas_are_accumulated_before_dispatch(self):
        from src.utils.llm_client import llmClient
        client=llmClient(); client.get_full_url=lambda _:'https://fixture.test/chat';client.get_headers=lambda:{}
        import json
        chunks=[{'choices':[{'delta':{'tool_calls':[{'index':0,'id':'call-1','type':'function','function':{'name':'duckduckgo_','arguments':'{"query":'}}]}}]}, {'choices':[{'delta':{'tool_calls':[{'index':0,'function':{'name':'search','arguments':'"Pune"}'}}]},'finish_reason':'tool_calls'}]}]
        response=types.SimpleNamespace(status_code=200,iter_lines=lambda:iter([('data: '+json.dumps(chunk)).encode() for chunk in chunks]),close=lambda:None)
        with patch('src.utils.llm_client.requests.post',return_value=response):
            deltas=list(client.call_api_stream('chat',{'model':'gemini-3.5-flash','messages':[]}))
        call=deltas[-1]['accumulated_tool_calls'][0]
        self.assertEqual(call['function']['name'],'duckduckgo_search')
        self.assertEqual(json.loads(call['function']['arguments']),{'query':'Pune'})


if __name__ == '__main__': unittest.main()
