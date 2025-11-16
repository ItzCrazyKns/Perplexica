import Foundation

enum PerplexicaAPIError: Error, LocalizedError {
    case invalidBaseURL
    case invalidResponse
    case missingProviders
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "The Perplexica base URL is invalid."
        case .invalidResponse:
            return "Received an invalid response from the server."
        case .missingProviders:
            return "No providers were returned. Configure models on the server."
        case .serverError(let message):
            return message
        }
    }
}

final class PerplexicaAPI {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func fetchProviders(baseURL: String, apiKey: String?) async throws -> [Provider] {
        guard let url = URL(string: baseURL)?.appending(path: "/api/providers") else {
            throw PerplexicaAPIError.invalidBaseURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let apiKey, !apiKey.isEmpty {
            request.addValue(apiKey, forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              200..<300 ~= httpResponse.statusCode else {
            throw PerplexicaAPIError.invalidResponse
        }

        let decoded = try JSONDecoder().decode(ProviderResponse.self, from: data)
        guard !decoded.providers.isEmpty else {
            throw PerplexicaAPIError.missingProviders
        }

        return decoded.providers
    }

    func sendMessage(
        baseURL: String,
        apiKey: String?,
        payload: [String: Any]
    ) async throws -> AsyncThrowingStream<ChatEvent, Error> {
        guard let url = URL(string: baseURL)?.appending(path: "/api/chat") else {
            throw PerplexicaAPIError.invalidBaseURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey, !apiKey.isEmpty {
            request.addValue(apiKey, forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (bytes, response) = try await session.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              200..<300 ~= httpResponse.statusCode else {
            let body = String(bytes: Array(bytes), encoding: .utf8) ?? ""
            throw PerplexicaAPIError.serverError(body)
        }

        return AsyncThrowingStream { continuation in
            Task {
                var buffer = Data()
                do {
                    for try await byte in bytes {
                        buffer.append(byte)
                        if byte == UInt8(ascii: "\n") {
                            if buffer.isEmpty { continue }
                            if let jsonObject = try? JSONSerialization.jsonObject(with: buffer),
                               let dict = jsonObject as? [String: Any] {
                                if let event = ChatEvent(dict: dict) {
                                    continuation.yield(event)
                                }
                            }
                            buffer.removeAll(keepingCapacity: true)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}

enum ChatEvent {
    case message(messageId: String, text: String)
    case sources(messageId: String, sources: [[String: Any]])
    case messageEnd
    case error(String)

    init?(dict: [String: Any]) {
        guard let type = dict["type"] as? String else { return nil }
        switch type {
        case "message":
            guard let messageId = dict["messageId"] as? String,
                  let data = dict["data"] as? String else { return nil }
            self = .message(messageId: messageId, text: data)
        case "sources":
            guard let messageId = dict["messageId"] as? String,
                  let data = dict["data"] as? [[String: Any]] else { return nil }
            self = .sources(messageId: messageId, sources: data)
        case "messageEnd":
            self = .messageEnd
        case "error":
            self = .error(dict["data"] as? String ?? "Unknown error")
        default:
            return nil
        }
    }
}
