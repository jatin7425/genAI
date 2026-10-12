import base64
import io
from pathlib import Path
import sys
import time
import types
import unittest

# Avoid starting the production composition root or connecting to MongoDB.
api = types.ModuleType('src.api')
api.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/api')]
sys.modules['src.api'] = api
utils = types.ModuleType('src.utils')
utils.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/utils')]
sys.modules['src.utils'] = utils

import fitz
from docx import Document
from fastapi import Depends, FastAPI, HTTPException, Header
from fastapi.testclient import TestClient
from PIL import Image
from src.api.view.attachment_view import AttachmentService, MAX_FILE_BYTES
from src.api.view.chat_view import ChatService
from src.api.view.model_view import ModelService
from src.utils.provider_errors import provider_error


class MemoryAttachments:
    def __init__(self): self.items = {}
    def insert(self, item): self.items[item['_id']] = item
    def get(self, key): return self.items.get(key)
    def bind(self, key, session):
        item = self.get(key)
        if not item or item['session_id'] not in (None, session): return False
        item['session_id'] = session
        item.pop('expires_at', None)
        return True
    def list_for_session(self, session): return [item for item in self.items.values() if item['session_id'] == session]
    def delete_draft(self, key):
        if self.get(key) and self.get(key)['session_id'] is None:
            del self.items[key]; return 1
        return 0
    def delete_session(self, session): self.items = {key: item for key, item in self.items.items() if item['session_id'] != session}


class AttachmentsTest(unittest.TestCase):
    def setUp(self): self.repo = MemoryAttachments(); self.service = AttachmentService(self.repo)

    def test_text_scoped_context_pagination_and_cleanup(self):
        meta = self.service.upload(b'Project facts: revenue increased.\n' * 800, 'notes.txt')
        self.assertIn('expires_at', self.repo.get(meta['id']))
        parts = self.service.content('Summarize this', [meta['id']], 'chat-a', bind=True)
        self.assertIn('Project facts', parts[1]['text'])
        self.assertNotIn('expires_at', self.repo.get(meta['id']))
        self.assertIsNotNone(self.service.read('chat-a', meta['id'])['next_offset'])
        self.assertEqual(self.repo.delete_draft(meta['id']), 0)
        with self.assertRaises(HTTPException): self.service.content('Read', [meta['id']], 'chat-b', bind=True)
        self.repo.delete_session('chat-a'); self.assertIsNone(self.repo.get(meta['id']))

    def test_image_is_normalized_for_vision_and_original_is_downloadable(self):
        stream = io.BytesIO(); Image.new('RGB', (80, 60), 'red').save(stream, format='PNG')
        original = stream.getvalue()
        meta = self.service.upload(original, 'picture.png')
        parts = self.service.content('What is this?', [meta['id']], 'chat', bind=True)
        self.assertEqual(meta['kind'], 'image')
        self.assertEqual(self.repo.get(meta['id'])['data'], original)
        self.assertTrue(parts[-1]['image_url']['url'].startswith('data:image/jpeg;base64,'))
        normalized = base64.b64decode(parts[-1]['image_url']['url'].split(',')[1])
        self.assertEqual(Image.open(io.BytesIO(normalized)).format, 'JPEG')

    def test_pdf_and_docx_extract_text(self):
        pdf = fitz.open(); page = pdf.new_page(); page.insert_text((40,40), 'Readable PDF content')
        meta = self.service.upload(pdf.tobytes(), 'report.pdf'); pdf.close()
        self.assertIn('Readable PDF content', self.repo.get(meta['id'])['text'])
        doc = Document(); doc.add_paragraph('Readable DOCX content'); stream = io.BytesIO(); doc.save(stream)
        meta = self.service.upload(stream.getvalue(), 'report.docx')
        self.assertIn('Readable DOCX content', self.repo.get(meta['id'])['text'])

    def test_invalid_oversized_and_duplicate_files(self):
        for raw, name in [(b'', 'empty.txt'), (b'broken', 'broken.png'), (b'binary', 'program.exe'), (b'x' * (MAX_FILE_BYTES+1), 'large.txt')]:
            with self.subTest(name=name), self.assertRaises(HTTPException): self.service.upload(raw, name)
        meta = self.service.upload(b'ok', 'notes.txt')
        with self.assertRaises(HTTPException): self.service.content('Read', [meta['id'], meta['id']], 'chat', bind=True)

    def test_authenticated_upload_and_download_routes(self):
        sys.modules['src.api.deps'] = types.SimpleNamespace(attachment_service=self.service)
        from src.api.endpoint.attachments import router
        def require_auth(authorization: str | None = Header(default=None)):
            if authorization != 'Bearer fixture': raise HTTPException(401, 'Sign in required')
        app = FastAPI(); app.include_router(router, dependencies=[Depends(require_auth)])
        client = TestClient(app)
        self.assertEqual(client.post('/attachments', files={'file': ('notes.txt', b'hello')}).status_code, 401)
        headers = {'Authorization': 'Bearer fixture'}
        response = client.post('/attachments', files={'file': ('notes.txt', b'hello')}, headers=headers)
        self.assertEqual(response.status_code, 200)
        key = response.json()['id']
        self.assertEqual(client.get(f'/attachments/{key}/content').status_code, 401)
        content = client.get(f'/attachments/{key}/content', headers=headers)
        self.assertEqual(content.content, b'hello')
        self.assertEqual(content.headers['cache-control'], 'private, no-store')
        self.assertEqual(client.delete(f'/attachments/{key}', headers=headers).status_code, 200)

    def test_chat_switching_restores_attachment_context_and_retries(self):
        meta = self.service.upload(b'Attachment fact: budget is 250.', 'budget.txt')
        class Agent:
            calls = []
            def build_system_message(self, prompt): return {'role':'system','content':prompt}
            def run(inner, messages, model=None, **kwargs):
                inner.calls.append((model, list(messages)))
                messages.append({'role':'assistant','content':'Answer'})
                return {'status':'done','answer':'Answer','sources':[],'confidence':'high'}
        agent = Agent()
        personas = types.SimpleNamespace(get_prompt=lambda _: 'Helpful assistant')
        broadcaster = types.SimpleNamespace(broadcast=lambda *_: None)
        chat = ChatService(agent, personas, broadcaster, attachment_service=self.service)
        _, stream = chat.handle_message('same-chat', 'Read budget', 'Default', 'gemini-3.5-flash', attachment_ids=[meta['id']]); list(stream)
        _, stream = chat.handle_message('same-chat', 'What was the budget?', 'Default', 'openai/gpt-oss-120b'); list(stream)
        self.assertEqual([item[0] for item in agent.calls], ['gemini-3.5-flash','openai/gpt-oss-120b'])
        self.assertIn('250', str(agent.calls[-1][1]))
        _, stream = chat.handle_message('same-chat', 'New question', 'Default', 'gemini-3.5-flash', retry=True); list(stream)
        self.assertNotIn('What was the budget?', str(agent.calls[-1][1]))
        history = types.SimpleNamespace(get_session_memory=lambda *_args, **_kwargs: {'items':[{'kind':'user','text':'Read budget','attachments':[meta]}]})
        resumed = ChatService(agent, personas, broadcaster, history, self.service)
        _, stream = resumed.handle_message('same-chat', 'Follow up', 'Default', 'gemini-3.5-flash'); list(stream)
        self.assertIn('Attachment fact', str(agent.calls[-1][1]))


class ProviderTest(unittest.TestCase):
    def test_limits_auth_and_unknown_reset(self):
        issue = provider_error(429, {'error':{'message':'limit'}}, {'Retry-After':'60'}, 'gemini-3.5-flash').issue
        self.assertEqual(issue['code'], 'provider_limit'); self.assertEqual(issue['retry_after_seconds'], 60)
        self.assertNotIn('tomorrow', provider_error(429, {'error':'quota'}).issue['message'])
        self.assertEqual(provider_error(401, {'error':'expired token'}).issue['code'], 'provider_auth')
        self.assertEqual(provider_error(502, {'error':'no healthy upstreams','tried':[]}).issue['code'], 'provider_limit')
        self.assertEqual(provider_error(400, {'error':'images are unsupported'}).issue['code'], 'vision_unsupported')
        self.assertEqual(provider_error(503, {'error':'sensitive upstream details'}).issue['code'], 'provider_unavailable')
        self.assertNotIn('sensitive', provider_error(503, {'error':'sensitive upstream details'}).issue['message'])

    def test_model_catalog_excludes_non_chat_modes(self):
        client = types.SimpleNamespace(list_models=lambda: [{'id':'gemini-3.5-flash','mode':'chat'}, {'id':'gemini-embedding-001','mode':'embedding'}, {'id':'whisper-large-v3-turbo','mode':'transcription'}])
        self.assertEqual(ModelService(client).list_models(), ['gemini-3.5-flash'])


if __name__ == '__main__': unittest.main()
