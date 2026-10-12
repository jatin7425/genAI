import os

from src.agents.orchestrator_agent import orchestrator
from src.api.utils.broadcaster import EventBroadcaster
from src.api.view.auth_view import AuthService
from src.api.view.chat_view import ChatService
from src.api.view.conversation_view import ConversationService
from src.api.view.model_view import ModelService
from src.api.view.persona_view import PersonaService
from src.api.view.suggestion_view import SuggestionService
from src.utils.llm_client import llmClient

# Composition root: this is the only place that needs to change to swap one
# repository implementation for another — everything else only ever depends
# on the repository's list/get/save/delete interface, never the storage
# behind it.
from src.api.repositories.mongo.conversation_repository import MongoConversationRepository as ConversationRepository
from src.api.repositories.mongo.persona_repository import MongoPersonaRepository as PersonaRepository

from src.api.repositories.mongo.attachment_repository import MongoAttachmentRepository
from src.api.view.attachment_view import AttachmentService

attachment_repository = MongoAttachmentRepository()
attachment_service = AttachmentService(attachment_repository)
event_broadcaster = EventBroadcaster()
agent = orchestrator()
llm_client = llmClient()
persona_repository = PersonaRepository()
persona_service = PersonaService(persona_repository)
conversation_repository = ConversationRepository()
conversation_service = ConversationService(conversation_repository, event_broadcaster, attachment_repository)
chat_service = ChatService(agent, persona_service, event_broadcaster, conversation_service, attachment_service)
auth_service = AuthService(os.getenv("AUTH_USERNAME"), os.getenv("AUTH_PASSWORD_HASH"))
model_service = ModelService(llm_client)
suggestion_service = SuggestionService(llm_client)
