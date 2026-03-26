# Solvent AI

Solvent AI is a **smart, hierarchical AI assistant** designed to seamlessly switch between cloud-based reasoning (Gemini Pro/Vision) and local privacy-focused models (Ollama/Qwen).

## 📚 Documentation

- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** — Complete summary of all features and changes
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** — Developer quick reference guide
- **[CHANGELOG.md](./CHANGELOG.md)** — Full changelog
- **[HARDENING_PLAN.md](./HARDENING_PLAN.md)** — Original hardening plan
- **[docs/bug-fixes-plan.md](./docs/bug-fixes-plan.md)** — Bug fixes implementation plan

## 🚀 Features

- **Smart Router:** Automatically routes queries between Gemini (Cloud) and Ollama (Local) based on complexity, availability, and user mode.
- **Deep Thought Mode:** Enforces a "Chain of Thought" reasoning process for complex queries.
- **Graph Extraction:** Visualizes relationships in your data by extracting knowledge graphs from AI responses.
- **Browser Mode:** Injects real-time search results (via Serper) into the context for up-to-date answers.
- **Vision Support:** Multimodal capabilities using Gemini Vision.
- **Async Task Infrastructure:** Redis-backed queue system for handling high-latency operations like project indexing and memory maintenance.
- **Plugin Architecture:** Dynamic plugin system for extending AI providers and tools without modifying core code.

### 🆕 New Features (March 2026)

- **Session Persistence:** Conversations auto-save to disk and survive restarts
- **Conversation Branching:** Fork from any message to explore alternative paths
- **Decision Review:** Approve/reject Supervisor actions before execution
- **Mission Dashboard:** Real-time visibility into agent activity
- **Global Search:** Cmd+K to search across all sessions and memories
- **Browser Pin/Unpin:** Save important pages for quick access
- **Codebase Indexing:** Automatic file watching and incremental indexing
- **Error Boundaries:** Graceful error handling throughout the UI

## 🏗 Architecture

This project is structured as a monorepo:

- **`frontend/`**: React + TypeScript + Tailwind CSS application. Features a modern "Bento" UI and interactive graph visualization.
- **`backend/`**: Node.js + Express + TypeScript API. Handles API routing, prompt engineering, and service orchestration.

## 🛠️ Tech Stack

- **Frontend:** React, Vite, Lucide React, Zustand (Store)
- **Backend:** Express, Zod (Validation), Dotenv
- **AI Services:** Google Gemini API, Ollama (Local), Serper.dev (Search)

## ⚡ Getting Started

### Prerequisites
- Node.js (v18+)
- Ollama (running locally)
- Google AI Studio API Key
- Serper API Key (optional, for web search)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/solvent-ai.git
    cd solvent-ai
    ```

2.  **Setup Backend:**
    ```bash
    cd backend
    npm install
    # Create .env file with your API keys
    npm run dev
    ```

3.  **Setup Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
