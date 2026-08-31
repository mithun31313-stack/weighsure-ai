import { useRef, useState } from "react";
import { Usb, Plug, PlugZap } from "lucide-react";
import { useLang } from "../lib/lang";

// Minimal Web Serial type shims (not yet in all TS DOM lib versions)
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}
interface NavigatorSerial {
  serial?: {
    requestPort(): Promise<SerialPortLike>;
  };
}

/**
 * Connects to a real USB/serial digital scale via the Web Serial API
 * (Chrome/Edge only, requires HTTPS or localhost). Parses the first
 * floating-point number found in each line of incoming text as the
 * current weight reading — a reasonable common denominator across many
 * simple ASCII scale output protocols. Instruments with a different
 * output format will need a custom parser swapped in here.
 */
export function LiveInstrument() {
  const { t } = useLang();
  const [supported] = useState(() => typeof navigator !== "undefined" && "serial" in navigator);
  const [connected, setConnected] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  async function connect() {
    setError(null);
    try {
      const nav = navigator as NavigatorSerial;
      if (!nav.serial) throw new Error("Web Serial not supported in this browser");
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setConnected(true);

      const stream = port.readable;
      if (!stream) throw new Error("Port has no readable stream");
      const textDecoder = new TextDecoderStream();
      // TS DOM lib types TextDecoderStream's writable as WritableStream<BufferSource> while our
      // readable stream is typed as Uint8Array — these are runtime-compatible (Uint8Array IS a
      // BufferSource), so the cast here is safe, just working around a lib.dom.d.ts type mismatch.
      stream.pipeTo(textDecoder.writable as unknown as WritableStream<Uint8Array>).catch(() => {});
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader as unknown as ReadableStreamDefaultReader<Uint8Array>;

      let buffer = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const match = line.match(/-?\d+(\.\d+)?/);
          if (match) setReading(match[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnected(false);
    }
  }

  async function disconnect() {
    try {
      await readerRef.current?.cancel();
      await portRef.current?.close();
    } catch {
      /* ignore */
    }
    setConnected(false);
    setReading(null);
  }

  return (
    <div className="bg-surface-raised border border-hairline rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <Usb size={15} /> {t("live.title")}
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-mono ${connected ? "text-pass" : "text-steel"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-pass" : "bg-hairline"}`} />
          {connected ? t("live.connected") : t("live.disconnected")}
        </span>
      </div>

      {!supported ? (
        <p className="text-xs text-steel">{t("live.unsupported")}</p>
      ) : (
        <>
          <div className="font-mono text-3xl text-ink mb-3">
            {reading ?? "—"} <span className="text-sm text-steel">kg</span>
          </div>
          {error && <div className="text-xs text-fail bg-fail-bg rounded-md px-2 py-1 mb-2">{error}</div>}
          <button
            onClick={connected ? disconnect : connect}
            className={`flex items-center gap-1.5 rounded-md text-white text-xs font-medium px-3 py-2 transition-colors ${
              connected ? "bg-fail hover:opacity-90" : "bg-ink hover:bg-ink-light"
            }`}
          >
            {connected ? <><PlugZap size={13} /> {t("live.disconnect")}</> : <><Plug size={13} /> {t("live.connect")}</>}
          </button>
          <p className="text-[10px] text-steel mt-2">{t("live.hint")}</p>
        </>
      )}
    </div>
  );
}
