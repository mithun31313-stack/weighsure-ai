import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, X, Sparkles, Send } from "lucide-react";
import { useLang } from "../lib/lang";
import { api, type ChatResponse } from "../lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function ChatWidget() {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", text: t("chat.greeting") }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the greeting in sync with language changes, as long as the user hasn't started chatting yet.
  useEffect(() => {
    setMessages((m) => (m.length === 1 && m[0].role === "assistant" ? [{ role: "assistant", text: t("chat.greeting") }] : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<ChatResponse>("/ai/chat", { message: text, lang });
      setMessages((m) => [...m, { role: "assistant", text: res.response }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t("chat.error") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[520px] bg-surface-raised border border-hairline rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-ink text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-brass-light" />
              <span className="text-sm font-semibold font-display">{t("chat.title")}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-steel-light hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-ink text-white" : "bg-surface text-ink border border-hairline"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-surface border border-hairline rounded-lg px-3 py-2 text-xs text-steel">
                  {t("chat.thinking")}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={send} className="flex items-center gap-2 border-t border-hairline p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder")}
              className="flex-1 text-xs rounded-md border border-hairline px-3 py-2 outline-none focus:border-brass"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-ink text-white p-2 hover:bg-ink-light transition-colors disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-brass text-white shadow-lg hover:bg-brass-light transition-colors"
        aria-label="Open AI Laboratory Assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
