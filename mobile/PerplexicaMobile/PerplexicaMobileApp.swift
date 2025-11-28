import SwiftUI

@main
struct PerplexicaMobileApp: App {
    @StateObject private var settings = AppSettings()
    @StateObject private var chatViewModel = ChatViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(settings)
                .environmentObject(chatViewModel)
                .task {
                    await chatViewModel.bootstrap(settings: settings)
                }
        }
    }
}
