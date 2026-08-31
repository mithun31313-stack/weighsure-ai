import { Languages } from "lucide-react";
import { useLang } from "../lib/lang";
import { LANG_LABELS, type Lang } from "../lib/translations";

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();

  return (
    <div className={`flex items-center gap-1.5 ${dark ? "text-steel-light" : "text-steel"}`}>
      <Languages size={14} />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className={`text-xs bg-transparent outline-none cursor-pointer ${dark ? "text-steel-light" : "text-steel"}`}
      >
        {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
          <option key={l} value={l} className="text-ink">
            {LANG_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
