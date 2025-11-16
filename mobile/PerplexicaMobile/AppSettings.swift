import Foundation

@MainActor
final class AppSettings: ObservableObject {
    @Published var baseURLString: String
    @Published var apiKey: String
    @Published var selectedFocusMode: FocusMode
    @Published var selectedOptimizationMode: OptimizationMode
    @Published var selectedChatModel: Provider.Model?
    @Published var selectedEmbeddingModel: Provider.Model?

    private let defaults = UserDefaults.standard

    init() {
        baseURLString = defaults.string(forKey: .baseURLKey) ?? "http://10.0.0.222:3000"
        apiKey = defaults.string(forKey: .apiKey) ?? ""
        selectedFocusMode = FocusMode(rawValue: defaults.string(forKey: .focusMode) ?? "") ?? .webSearch
        selectedOptimizationMode = OptimizationMode(rawValue: defaults.string(forKey: .optimizationMode) ?? "") ?? .balanced
        if let chatData = defaults.data(forKey: .chatModel),
           let model = try? JSONDecoder().decode(Provider.Model.self, from: chatData) {
            selectedChatModel = model
        }
        if let embeddingData = defaults.data(forKey: .embeddingModel),
           let model = try? JSONDecoder().decode(Provider.Model.self, from: embeddingData) {
            selectedEmbeddingModel = model
        }
    }

    func save() {
        defaults.set(baseURLString, forKey: .baseURLKey)
        defaults.set(apiKey, forKey: .apiKey)
        defaults.set(selectedFocusMode.rawValue, forKey: .focusMode)
        defaults.set(selectedOptimizationMode.rawValue, forKey: .optimizationMode)
        if let encodedChat = try? JSONEncoder().encode(selectedChatModel) {
            defaults.set(encodedChat, forKey: .chatModel)
        }
        if let encodedEmbedding = try? JSONEncoder().encode(selectedEmbeddingModel) {
            defaults.set(encodedEmbedding, forKey: .embeddingModel)
        }
    }
}

private extension String {
    static let baseURLKey = "perplexica.baseURL"
    static let apiKey = "perplexica.apiKey"
    static let focusMode = "perplexica.focusMode"
    static let optimizationMode = "perplexica.optimizationMode"
    static let chatModel = "perplexica.chatModel"
    static let embeddingModel = "perplexica.embeddingModel"
}
