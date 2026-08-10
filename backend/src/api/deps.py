import os

from src.agents.orchestrator_agent import orchestrator
from src.api.utils.broadcaster import EventBroadcaster
from src.api.view.auth_view import AuthService
from src.api.view.chat_view import ChatService
from src.api.view.conversation_view import ConversationService
from src.api.view.document_view import DocumentService
from src.api.view.model_view import ModelService
from src.api.view.persona_view import PersonaService
from src.api.view.suggestion_view import SuggestionService
from src.config import CONFIG
from src.utils.llm_client import llmClient

# Composition root: this is the only place that needs to change to swap one
# repository implementation for another — everything else only ever depends
# on the repository's list/get/save/delete interface, never the storage
# behind it.
from src.api.repositories.mongo.conversation_repository import MongoConversationRepository as ConversationRepository
from src.api.repositories.mongo.document_repository import MongoDocumentRepository as DocumentRepository
from src.api.repositories.mongo.persona_repository import MongoPersonaRepository as PersonaRepository

event_broadcaster = EventBroadcaster()
agent = orchestrator()
llm_client = llmClient()
persona_repository = PersonaRepository()
persona_service = PersonaService(persona_repository)
chat_service = ChatService(agent, persona_service, event_broadcaster)
auth_service = AuthService(os.getenv("AUTH_USERNAME"), os.getenv("AUTH_PASSWORD_HASH"))
document_repository = DocumentRepository()
document_service = DocumentService(document_repository, llm_client, CONFIG.get("models", {}).get("embedding"))
conversation_repository = ConversationRepository()
conversation_service = ConversationService(conversation_repository, event_broadcaster)
model_service = ModelService(llm_client)
suggestion_service = SuggestionService(llm_client)
