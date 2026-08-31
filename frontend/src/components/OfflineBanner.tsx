import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLang } from "../lib/lang";

export function OfflineBanner() {
  const { t } = useLang();
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="flex items-center gap-2 bg-warn-bg text-warn text-xs font-medium px-4 py-2 border-b border-warn/20">
      <WifiOff size={13} />
      {t("offline.banner")}
    </div>
  );
}
