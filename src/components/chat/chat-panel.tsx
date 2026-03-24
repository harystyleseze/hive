"use client";

import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";

export function ChatPanel() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/chat" }),
  });
  const [inputValue, setInputValue] = useState("");
  const isLoading = status === "streaming" || status === "submitted";

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  const suggestions = [
    "Hire the market analyst and assess current conditions",
    "What is the current HBAR volatility?",
    "Propose a conservative deposit into a Bonzo vault",
    "Run a full portfolio risk assessment",
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="pt-8 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">H</span>
            </div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))] mb-1">
              Hive Orchestrator
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] max-w-sm mx-auto">
              I&apos;m an autonomous agent that hires specialists and pays them in HBAR to manage
              your DeFi strategy on Hedera.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 max-w-sm mx-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInputValue(s)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 hover:bg-[hsl(var(--muted))]/40 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-[hsl(var(--foreground))]"
                  : "bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
              }`}
            >
              {msg.parts ? (
                msg.parts.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p key={i} className="whitespace-pre-wrap leading-relaxed">
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type.startsWith("tool-")) {
                    const toolName = part.type.replace(/^tool-/, "");
                    const isDone = "output" in part && part.output !== undefined;
                    return (
                      <div
                        key={i}
                        className="mt-2 p-2 rounded-lg bg-[hsl(var(--muted))]/40 border border-[hsl(var(--border))] text-[10px] font-mono text-[hsl(var(--muted-foreground))]"
                      >
                        <span className="text-blue-400">⚡ {toolName}</span>
                        {isDone && (
                          <p className="mt-1 text-emerald-400/70">✓ completed</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                })
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{(msg as { content?: string }).content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))]">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 text-center py-2">
            Error: {error.message}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-[hsl(var(--border))]">
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask the Orchestrator..."
            className="flex-1 px-3 py-2 text-sm bg-[hsl(var(--muted))]/30 border border-[hsl(var(--border))] rounded-lg text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:border-emerald-500/50 focus:bg-[hsl(var(--muted))]/40 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
