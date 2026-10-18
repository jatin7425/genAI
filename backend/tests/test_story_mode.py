import copy
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import Mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
api = sys.modules.setdefault('src.api', types.ModuleType('src.api'))
api.__path__ = [str(Path(__file__).resolve().parents[1] / 'src/api')]
from src.api.view.chat_view import ChatService
from src.api.view.story_view import StoryService, narrator_prompt
from test_agent_flow import tool


class MemoryStories:
    def __init__(self): self.items = {}
    def get(self, session_id): return copy.deepcopy(self.items.get(session_id))
    def save(self, story): self.items[story['session_id']] = copy.deepcopy(story); return story
    def delete(self, session_id): self.items.pop(session_id, None)


class DraftClient:
    def __init__(self, content): self.content = content; self.calls = []
    def available_models(self): return ['writer']
    def call_api(self, endpoint, payload):
        self.calls.append(payload)
        return {'choices': [{'message': {'content': self.content}}]}


class StoryTests(unittest.TestCase):
    def test_create_from_description_drafts_missing_fields_and_keeps_user_cast(self):
        draft = {'title': 'Ashes of Vey', 'premise': 'A city burns.', 'user_role': 'Kara, a thief', 'characters': [{'name': 'Orin', 'description': 'Old guard'}, {'name': 'mira', 'description': 'Drafted Mira'}]}
        broadcaster = Mock()
        service = StoryService(MemoryStories(), broadcaster, DraftClient('Here: ' + json.dumps(draft)))
        story = service.create('s1', characters=[{'name': 'Mira', 'description': 'Smuggler'}], description='A heist in a burning city; I play Kara')
        self.assertEqual(story['title'], 'Ashes of Vey')
        self.assertEqual(story['user_role'], 'Kara, a thief')
        self.assertEqual(story['characters'], [{'name': 'Mira', 'description': 'Smuggler'}, {'name': 'Orin', 'description': 'Old guard'}])
        broadcaster.broadcast.assert_called_with('story_updated', story)

    def test_unparseable_draft_falls_back_to_description_as_premise(self):
        service = StoryService(MemoryStories(), Mock(), DraftClient('not json'))
        story = service.create('s1', description='Two rivals stranded on the moon')
        self.assertEqual(story['premise'], 'Two rivals stranded on the moon')
        self.assertEqual(story['characters'], [])

    def test_characters_update_by_name_rename_and_cap(self):
        service = StoryService(MemoryStories(), Mock())
        service.create('s1', premise='Start')
        service.save_character('s1', 'Orin', 'Guard')
        story, _ = service.save_character('s1', 'orin', 'Guard, now a traitor')
        self.assertEqual(story['characters'], [{'name': 'orin', 'description': 'Guard, now a traitor'}])
        story, _ = service.save_character('s1', 'Orin the Red', 'Traitor', original_name='orin')
        self.assertEqual([c['name'] for c in story['characters']], ['Orin the Red'])
        for i in range(29): service.save_character('s1', f'Extra {i}', '')
        _, error = service.save_character('s1', 'One too many', '')
        self.assertIn('limited', error)
        self.assertEqual(service.save_character('missing', 'A', '')[1], 'This conversation is not a story.')

    def test_narrator_prompt_reflects_participation(self):
        story = {'title': 'T', 'premise': 'P', 'user_role': '', 'characters': [{'name': 'Orin', 'description': 'Guard'}]}
        self.assertIn('not a character', narrator_prompt(story))
        self.assertIn('- Orin: Guard', narrator_prompt(story))
        story['user_role'] = 'Kara'
        self.assertIn('plays this character in the story: Kara', narrator_prompt(story))

    def test_story_chat_uses_narrator_and_saved_characters_join_the_bible(self):
        stories = StoryService(MemoryStories(), Mock())
        stories.create('story', premise='A storm hits the harbor.', characters=[{'name': 'Orin', 'description': 'Harbor guard'}])

        class Agent:
            def build_system_message(self, prompt): return {'role': 'system', 'content': prompt}
            def run(self, messages, extra_tool_dispatch=None, extra_tools=None, **kwargs):
                self.first_prompt = messages[0]['content']
                self.tools = [t['function']['name'] for t in extra_tools]
                extra_tool_dispatch['save_story_character'](name='Sela', description='A drowned sailor who returns')
                self.refreshed_prompt = messages[0]['content']
                messages.append({'role': 'assistant', 'content': 'The tide turns.'})
                return {'status': 'done', 'answer': 'The tide turns.'}

        agent = Agent()
        chat = ChatService(agent, types.SimpleNamespace(get_prompt=lambda _: 'Helpful persona'), Mock(), story_service=stories)
        _, stream = chat.handle_message('story', 'Begin the story.', 'Default', 'm'); list(stream)
        self.assertIn('Narrator', agent.first_prompt)
        self.assertNotIn('Helpful persona', agent.first_prompt)
        self.assertIn('save_story_character', agent.tools)
        self.assertIn('- Sela: A drowned sailor', agent.refreshed_prompt)
        self.assertEqual([c['name'] for c in stories.get('story')['characters']], ['Orin', 'Sela'])

    def test_ordinary_chat_has_no_story_tools(self):
        class Agent:
            def build_system_message(self, prompt): return {'role': 'system', 'content': prompt}
            def run(self, messages, extra_tools=None, **kwargs):
                self.tools = [t['function']['name'] for t in extra_tools]
                messages.append({'role': 'assistant', 'content': 'Hi'})
                return {'status': 'done', 'answer': 'Hi'}
        agent = Agent()
        chat = ChatService(agent, types.SimpleNamespace(get_prompt=lambda _: 'Helpful'), Mock(), story_service=StoryService(MemoryStories(), Mock()))
        _, stream = chat.handle_message('plain', 'Hello', 'Default', 'm'); list(stream)
        self.assertNotIn('save_story_character', agent.tools)


if __name__ == '__main__': unittest.main()
