import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var chatViewModel: ChatViewModel
    @Binding var isPresented: Bool

    @State private var tempBaseURL = ""
    @State private var tempApiKey = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Base URL", text: $tempBaseURL)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    SecureField("Authorization (optional)", text: $tempApiKey)
                        .textInputAutocapitalization(.never)
                }

                if chatViewModel.providers.isEmpty {
                    Section {
                        ProgressView("Loading providers…")
                    }
                } else {
                    Section("Chat Model") {
                        Picker("Provider", selection: Binding(
                            get: { settings.selectedChatModel?.id ?? "" },
                            set: { newValue in
                                if let provider = chatViewModel.providers.first(where: { $0.chatModels.contains(where: { $0.id == newValue }) }),
                                   let model = provider.chatModels.first(where: { $0.id == newValue }) {
                                    settings.selectedChatModel = model
                                }
                            }
                        )) {
                            Text("Select…").tag("")
                            ForEach(chatViewModel.providers) { provider in
                                ForEach(provider.chatModels) { model in
                                    Text("\(provider.name) — \(model.name)")
                                        .tag(model.id)
                                }
                            }
                        }
                    }

                    Section("Embedding Model") {
                        Picker("Provider", selection: Binding(
                            get: { settings.selectedEmbeddingModel?.id ?? "" },
                            set: { newValue in
                                if let provider = chatViewModel.providers.first(where: { $0.embeddingModels.contains(where: { $0.id == newValue }) }),
                                   let model = provider.embeddingModels.first(where: { $0.id == newValue }) {
                                    settings.selectedEmbeddingModel = model
                                }
                            }
                        )) {
                            Text("Select…").tag("")
                            ForEach(chatViewModel.providers) { provider in
                                ForEach(provider.embeddingModels) { model in
                                    Text("\(provider.name) — \(model.name)")
                                        .tag(model.id)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        settings.baseURLString = tempBaseURL
                        settings.apiKey = tempApiKey
                        settings.save()
                        isPresented = false
                    }
                }
            }
            .onAppear {
                tempBaseURL = settings.baseURLString
                tempApiKey = settings.apiKey
            }
        }
        .presentationDetents([.medium, .large])
    }
}
