import { Header } from "@/components/layout/header";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex max-w-screen-lg mx-auto w-full px-4 py-6">
        <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
            <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
              Orchestrator Chat
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Chat directly with the Hive Orchestrator agent
            </p>
          </div>
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}
