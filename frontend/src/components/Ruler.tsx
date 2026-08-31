interface RulerProps {
  className?: string;
  ticks?: number;
  majorEvery?: number;
  color?: string;
}

/**
 * The app's signature visual motif: a graduated verification-scale ruler,
 * directly referencing "e" — the verification scale interval that is the
 * literal technical unit every OIML R 76 acceptance criterion is expressed in.
 */
export function Ruler({ className = "", ticks = 40, majorEvery = 5, color = "#8296a8" }: RulerProps) {
  const items = Array.from({ length: ticks });
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {items.map((_, i) => {
        const isMajor = i % majorEvery === 0;
        return (
          <div
            key={i}
            style={{
              width: 1,
              height: isMajor ? 14 : 7,
              background: color,
              opacity: isMajor ? 0.9 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
}
