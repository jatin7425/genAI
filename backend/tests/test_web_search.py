import io
import json
import os
import socket
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.utils.web_search import webSearch
from src.agents.web_search_agent import WebSearchAgent
from test_agent_flow import ScriptedClient, tool


class WebSearchTest(unittest.TestCase):
    def setUp(self):
        self.search = webSearch()
        self.env = patch.dict(os.environ, {'BRAVE_SEARCH_API_KEY': ''}); self.env.start(); self.addCleanup(self.env.stop)

    def test_fallback_dedupes_urls_preserves_hindi_and_honors_filters(self):
        client = Mock(); client.__enter__ = Mock(return_value=client); client.__exit__ = Mock()
        client.text.side_effect = [RuntimeError('blocked'), [{'title':'हिंदी परिणाम','href':'https://example.com/a?utm_source=test','body':'यह हिंदी जानकारी है'}, {'title':'Duplicate','href':'https://example.com/a','body':'Duplicate'}]]
        with patch('src.utils.web_search.DDGS', return_value=client):
            result = self.search.duckduckgo_search('हिंदी समाचार', region='in-hi', timelimit='w')
            self.assertEqual(result['provider'], 'brave')
            self.assertEqual(len(result['results']), 1)
            self.assertEqual(result['results'][0]['snippet'], 'यह हिंदी जानकारी है')
            self.assertEqual(client.text.call_args.kwargs['timelimit'], 'w')
            self.assertEqual(client.text.call_args.kwargs['region'], 'in-hi')
            self.search.duckduckgo_search('हिंदी समाचार', region='in-hi', timelimit='w')
            self.assertEqual(client.text.call_count, 2)

    def test_empty_and_failed_searches_have_explicit_status_and_no_secret(self):
        client = Mock(); client.__enter__ = Mock(return_value=client); client.__exit__ = Mock()
        with patch('src.utils.web_search.DDGS', return_value=client):
            client.text.return_value = []
            self.assertEqual(self.search.duckduckgo_search('query')['status'], 'empty')
            client.text.side_effect = RuntimeError('secret-key-in-upstream-error')
            result = self.search.duckduckgo_search('query')
            self.assertEqual(result['status'], 'failed')
            self.assertNotIn('secret-key', json.dumps(result))

    def test_brave_api_is_used_only_when_configured_and_parses_results(self):
        response = Mock(); response.json.return_value = {'web': {'results': [{'title':'Docs','url':'https://example.com/docs','description':'Official documentation'}]}}
        with patch.dict(os.environ, {'BRAVE_SEARCH_API_KEY':'fixture-secret'}), patch('src.utils.web_search.requests.get', return_value=response) as get, patch('src.utils.web_search.DDGS') as ddgs:
            result = self.search.duckduckgo_search('docs', timelimit='d')
            self.assertEqual(result['provider'], 'brave_api'); ddgs.assert_not_called()
            self.assertEqual(get.call_args.kwargs['params']['freshness'], 'pd')
            self.assertNotIn('fixture-secret', json.dumps(result)); response.close.assert_called_once()

    def test_brave_api_failure_falls_back_to_free_engine(self):
        client = Mock(); client.__enter__ = Mock(return_value=client); client.__exit__ = Mock(); client.text.return_value = [{'title':'Docs','href':'https://example.com','body':'Found'}]
        with patch.dict(os.environ, {'BRAVE_SEARCH_API_KEY':'fixture'}), patch('src.utils.web_search.requests.get', side_effect=RuntimeError('unauthorized')), patch('src.utils.web_search.DDGS', return_value=client):
            self.assertEqual(self.search.duckduckgo_search('docs')['provider'], 'duckduckgo')

    def test_reads_article_text_not_keyword_counts_and_paginates_cached_text(self):
        body = '<html><title>Article</title><meta property="article:published_time" content="2026-10-14"><nav>Menu noise</nav><article><h1>Evidence</h1><p>' + 'This article provides a source fact and supporting evidence. '*130 + '</p></article><script>ignore()</script></html>'
        with patch.object(self.search, '_download', return_value=('https://example.com/article','text/html',body.encode(),'utf-8')) as download:
            first = self.search.read_page('https://example.com/article','source fact')
            self.assertEqual(first['status'], 'success'); self.assertIn('source fact', first['text']); self.assertNotIn('Menu noise', first['text']); self.assertNotIn('ignore()', first['text'])
            self.assertEqual(first['published_at'], '2026-10-14'); self.assertEqual(first['next_offset'], 5000)
            second = self.search.read_page('https://example.com/article', offset=first['next_offset'])
            self.assertTrue(second['text']); self.assertEqual(download.call_count, 1)
            self.assertNotIn('matches', first)

    def test_reads_pdf_text(self):
        import fitz
        with fitz.open() as pdf:
            page = pdf.new_page(); page.insert_text((50,50),'A primary PDF source with detailed evidence about a research topic. '*3)
            raw = pdf.tobytes()
        with patch.object(self.search, '_download', return_value=('https://example.com/report.pdf','application/pdf',raw,'utf-8')):
            result = self.search.read_page('https://example.com/report.pdf')
            self.assertEqual(result['status'], 'success'); self.assertIn('primary PDF', result['text'])

    def test_private_addresses_and_credentials_are_blocked(self):
        for url in ['file:///etc/passwd','https://user:password@example.com','https://example.com:27017']:
            self.assertEqual(self.search.read_page(url)['status'], 'failed')
        for address in ['127.0.0.1','169.254.169.254','10.0.0.1','::1']:
            with patch('src.utils.web_search.socket.getaddrinfo', return_value=[(None,None,None,None,(address,80))]), patch('src.utils.web_search.requests.get') as get:
                self.assertEqual(self.search.read_page('http://private.test')['status'], 'failed'); get.assert_not_called()

    def test_dns_failure_is_explicit_and_credential_urls_do_not_leak(self):
        with patch('src.utils.web_search.socket.getaddrinfo', side_effect=socket.gaierror('failed')):
            self.assertEqual(self.search.read_page('https://example.com')['reason'], 'dns_failure')
        self.assertNotIn('password', json.dumps(self.search.read_page('https://user:password@example.com')))

    def test_redirects_are_rechecked_and_streams_are_closed(self):
        response = Mock(status_code=302, headers={'Location':'http://127.0.0.1/private'})
        with patch.object(self.search, '_public_url', side_effect=['https://example.com/',ValueError('private redirect')]), patch('src.utils.web_search.requests.get', return_value=response) as get:
            result = self.search.read_page('https://example.com')
            self.assertEqual(result['status'], 'failed'); self.assertEqual(get.call_count,1); response.close.assert_called_once()

    def test_oversized_and_javascript_only_pages_fail_explicitly(self):
        response = Mock(status_code=200,headers={'Content-Type':'text/html'},encoding='utf-8'); response.iter_content.return_value = iter([b'x'*(2*1024*1024+1)])
        with patch.object(self.search, '_public_url', return_value='https://example.com/'), patch('src.utils.web_search.requests.get', return_value=response):
            self.assertEqual(self.search.read_page('https://example.com')['status'],'failed'); response.close.assert_called_once()
        with patch.object(self.search, '_download', return_value=('https://example.com/','text/html',b'<html><script>app()</script></html>','utf-8')):
            self.assertEqual(self.search.read_page('https://example.com')['status'],'failed')


class ResearchEvidenceTest(unittest.TestCase):
    def agent(self, responses, results=None, readable=True):
        agent = WebSearchAgent(); agent.llm_client = ScriptedClient(responses)
        agent.web_search.duckduckgo_search = Mock(return_value=results or {'status':'success','results':[{'title':'Source','link':'https://example.com/','snippet':'Source fact'}]})
        agent.web_search.read_page = Mock(return_value={'status':'success','url':'https://example.com/','text':'Actual evidence.'} if readable else {'status':'failed','error':'Blocked'})
        return agent
    def search(self): return [{'accumulated_tool_calls':[tool('duckduckgo_search',{'query':'query'},'search')]}]
    def submit(self, url='https://example.com/', answer='Supported answer.'):
        return [{'accumulated_tool_calls':[tool('submit_answer',{'answer':answer,'sources':[url],'confidence':'high'},'submit')]}]

    def test_actual_page_text_reaches_model_and_unknown_sources_are_rejected(self):
        agent = self.agent([self.search(),self.submit('https://invented.test'),self.submit()])
        result = agent.web_search_agent('Research',model='selected')
        self.assertEqual(result['sources'],['https://example.com/']); self.assertEqual(result['confidence'],'high')
        self.assertIn('Actual evidence',str(agent.llm_client.calls[1]['messages']))
        self.assertEqual(len(agent.llm_client.calls),3)

    def test_redirected_source_remains_verified_under_original_search_url(self):
        agent = self.agent([self.search(),self.submit()])
        agent.web_search.read_page.return_value = {'status':'success','url':'https://example.com/final','text':'Actual evidence.'}
        self.assertEqual(agent.web_search_agent('Research',model='selected')['confidence'],'high')

    def test_failed_page_reading_downgrades_confidence_and_explains_snippets(self):
        agent = self.agent([self.search(),self.submit()],readable=False)
        result = agent.web_search_agent('Research',model='selected')
        self.assertEqual(result['confidence'],'low'); self.assertIn('snippets',result['note'])

    def test_empty_search_cannot_produce_verified_answer(self):
        agent = self.agent([self.search(),self.submit()],results={'status':'empty','results':[]})
        result = agent.web_search_agent('Research',max_iterations=2,model='selected')
        self.assertIsNone(result['answer']); self.assertEqual(result['sources'],[])

    def test_model_search_plan_triggers_real_search_and_citations_survive_plain_answer(self):
        agent = self.agent([[{'content':'I will search.'}],[{'content':'A supported plain answer.'}]])
        result = agent.web_search_agent('Research',model='selected')
        agent.web_search.duckduckgo_search.assert_called_once()
        self.assertEqual(result['sources'],['https://example.com/'])

    def test_invented_links_in_answer_are_not_allowed(self):
        agent = self.agent([self.search(),self.submit(answer='See https://fake.test/page'),self.submit()])
        result = agent.web_search_agent('Research',model='selected')
        self.assertEqual(result['answer'],'Supported answer.')


if __name__ == '__main__': unittest.main()
