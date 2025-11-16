import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var chatViewModel: ChatViewModel
    @State private var messageText = ""
    @State private var isPresentingSettings = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 16) {
                            ForEach(chatViewModel.messages) { message in
                                ChatBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                        .onChange(of: chatViewModel.messages.count) { _ in
                            if let last = chatViewModel.messages.last {
                                withAnimation {
                                    proxy.scrollTo(last.id, anchor: .bottom)
                                }
                            }
                        }
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: 8) {
                    if let error = chatViewModel.errorMessage {
                        Text(error)
                            .font(.footnote)
                            .foregroundColor(.red)
                            .padding(.horizontal)
                    }
                    HStack {
                        TextField("Ask Perplexica…", text: $messageText, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(1...4)
                        Button {
                            Task {
                                let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
                                messageText = ""
                                await chatViewModel.send(message: text, settings: settings)
                            }
                        } label: {
                            if chatViewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                            } else {
                                Image(systemName: "paperplane.fill")
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(chatViewModel.isLoading || messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    .padding([.horizontal, .bottom])
                }
                .background(.ultraThinMaterial)
            }
            .navigationTitle("Perplexica")
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Menu {
                        Picker("Focus Mode", selection: $settings.selectedFocusMode) {
                            ForEach(FocusMode.allCases) { mode in
                                Text(mode.label).tag(mode)
                            }
                        }
                        Picker("Optimization", selection: $settings.selectedOptimizationMode) {
                            ForEach(OptimizationMode.allCases) { mode in
                                Text(mode.label).tag(mode)
                            }
                        }
                        Button(role: .destructive) {
                            chatViewModel.resetConversation()
                        } label: {
                            Label("New Conversation", systemImage: "arrow.triangle.2.circlepath")
                        }
                    } label: {
                        Label("Modes", systemImage: "slider.horizontal.3")
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        isPresentingSettings = true
                    } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }
            }
            .sheet(isPresented: $isPresentingSettings) {
                SettingsView(isPresented: $isPresentingSettings)
                    .environmentObject(settings)
                    .environmentObject(chatViewModel)
            }
        }
    }
}

struct ChatBubble: View {
    let message: ChatMessage

    var body: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 6) {
            HStack {
                if message.role == .assistant {
                    Text("Perplexica")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else if message.role == .user {
                    Spacer()
                    Text("You")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Text(message.content.isEmpty ? "…" : message.content)
                .padding()
                .background(
                    message.role == .user ?
                        Color.accentColor.opacity(0.2) :
                        Color.secondary.opacity(0.15)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

            if !message.sources.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sources")
                        .font(.caption)
                        .bold()
                    ForEach(message.sources) { source in
                        if let url = source.url {
                            Link(destination: url) {
                                Text(source.title)
                                    .font(.caption)
                                    .lineLimit(1)
                            }
                        } else {
                            Text(source.title)
                                .font(.caption)
                        }
                    }
                }
                .padding(.horizontal, 12)
            }
        }
        .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
    }
}
