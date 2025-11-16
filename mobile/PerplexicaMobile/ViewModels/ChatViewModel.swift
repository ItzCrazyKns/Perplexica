import Foundation
import SwiftUI

@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var providers: [Provider] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let api = PerplexicaAPI()
    private var chatId = UUID().uuidString

    func bootstrap(settings: AppSettings) async {
        do {
            let providers = try await api.fetchProviders(
                baseURL: settings.baseURLString,
                apiKey: settings.apiKey
            )
            self.providers = providers
            if settings.selectedChatModel == nil,
               let provider = providers.first(where: { !$0.chatModels.isEmpty }),
               let model = provider.chatModels.first {
                settings.selectedChatModel = model
            }
            if settings.selectedEmbeddingModel == nil,
               let provider = providers.first(where: { !$0.embeddingModels.isEmpty }),
               let model = provider.embeddingModels.first {
                settings.selectedEmbeddingModel = model
            }
            settings.save()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func send(message text: String, settings: AppSettings) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        guard let chatModel = settings.selectedChatModel,
              let embeddingModel = settings.selectedEmbeddingModel else {
            errorMessage = "Select both chat and embedding models in settings."
            return
        }

        let messageId = UUID().uuidString
        messages.append(ChatMessage(id: messageId, role: .user, content: trimmed))
        isLoading = true
        errorMessage = nil

        let historyTuples = messages
            .filter { $0.role == .user || $0.role == .assistant }
            .map { msg -> [String] in
                let role = msg.role == .user ? "human" : "assistant"
                return [role, msg.content]
            }

        var streamMessageId: String?

        do {
            let stream = try await api.sendMessage(
                baseURL: settings.baseURLString,
                apiKey: settings.apiKey,
                payload: [
                    "message": [
                        "messageId": messageId,
                        "chatId": chatId,
                        "content": trimmed
                    ],
                    "optimizationMode": settings.selectedOptimizationMode.rawValue,
                    "focusMode": settings.selectedFocusMode.rawValue,
                    "history": historyTuples,
                    "files": [],
                    "chatModel": [
                        "providerId": chatModel.id,
                        "key": chatModel.key
                    ],
                    "embeddingModel": [
                        "providerId": embeddingModel.id,
                        "key": embeddingModel.key
                    ],
                    "systemInstructions": ""
                ]
            )

            for try await event in stream {
                switch event {
                case .message(let id, let text):
                    streamMessageId = id
                    if let index = messages.firstIndex(where: { $0.id == id }) {
                        messages[index].content += text
                    } else {
                        messages.append(ChatMessage(id: id, role: .assistant, content: text))
                    }
                case .sources(let id, let data):
                    guard let index = messages.firstIndex(where: { $0.id == id }) else { continue }
                    messages[index].sources = data.enumerated().map { offset, dict in
                        let title = dict["title"] as? String ?? "Source \(offset + 1)"
                        let urlString = dict["url"] as? String
                        return ChatMessage.Source(
                            id: "\(id)-\(offset)",
                            title: title,
                            url: urlString.flatMap(URL.init(string:))
                        )
                    }
                case .messageEnd:
                    isLoading = false
                case .error(let message):
                    errorMessage = message
                    isLoading = false
                }
            }
        } catch {
            isLoading = false
            errorMessage = error.localizedDescription
            if let streamId = streamMessageId,
               let index = messages.firstIndex(where: { $0.id == streamId }) {
                messages.remove(at: index)
            }
        }
    }

    func resetConversation() {
        messages.removeAll()
        chatId = UUID().uuidString
    }
}
