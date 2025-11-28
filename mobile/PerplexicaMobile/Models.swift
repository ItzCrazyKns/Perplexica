import Foundation

struct ChatMessage: Identifiable, Equatable {
    enum Role {
        case user
        case assistant
        case source
        case suggestion
    }

    let id: String
    let role: Role
    var content: String
    var sources: [Source] = []

    struct Source: Identifiable, Hashable {
        let id: String
        let title: String
        let url: URL?
    }
}

struct Provider: Codable, Identifiable {
    struct Model: Codable, Identifiable, Equatable {
        var id: String { key }
        let name: String
        let key: String
    }

    let id: String
    let name: String
    let chatModels: [Model]
    let embeddingModels: [Model]
}

struct ProviderResponse: Codable {
    let providers: [Provider]
}

enum FocusMode: String, CaseIterable, Identifiable {
    case webSearch
    case academicSearch
    case writingAssistant
    case wolframAlphaSearch
    case youtubeSearch
    case redditSearch

    var id: String { rawValue }
    var label: String {
        switch self {
        case .webSearch: return "All"
        case .academicSearch: return "Academic"
        case .writingAssistant: return "Writing"
        case .wolframAlphaSearch: return "Wolfram"
        case .youtubeSearch: return "YouTube"
        case .redditSearch: return "Reddit"
        }
    }
}

enum OptimizationMode: String, CaseIterable, Identifiable {
    case speed
    case balanced
    case quality

    var id: String { rawValue }
    var label: String {
        switch self {
        case .speed: return "Speed"
        case .balanced: return "Balanced"
        case .quality: return "Quality"
        }
    }
}
