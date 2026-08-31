import { createContext, useContext, useState, type ReactNode } from "react";
import { DICTS, type Lang } from "./translations";

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangState | null>(null);

function getInitialLang(): Lang {
  const stored = localStorage.getItem("ws_lang");
  if (stored === "en" || stored === "hi" || stored === "ta") return stored;
  return "en";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang());

  function setLang(l: Lang) {
    localStorage.setItem("ws_lang", l);
    setLangState(l);
  }

  function t(key: string): string {
    return DICTS[lang][key] ?? DICTS.en[key] ?? key;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
