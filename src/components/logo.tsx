import { cn } from "@/lib/utils";

/**
 * Logo AUTO+ — fidèle à la maquette :
 * silhouette de voiture dorée au-dessus du wordmark « AUTO+ »,
 * souligné par un filet doré. Vectoriel (net à toute taille).
 */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center select-none", className)}>
      {/* Silhouette voiture */}
      <svg
        viewBox="0 0 220 54"
        fill="none"
        className={compact ? "h-7 w-auto" : "h-12 w-auto"}
        aria-hidden
      >
        <defs>
          <linearGradient id="orAuto" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f5e6c4" />
            <stop offset="55%" stopColor="#d6b66f" />
            <stop offset="100%" stopColor="#a8833e" />
          </linearGradient>
        </defs>
        {/* carrosserie */}
        <path
          d="M18 38 C26 26, 48 16, 78 14 C104 12, 128 14, 142 20 C154 25, 168 27, 182 30 C196 33, 206 36, 206 38 L18 38 Z"
          stroke="url(#orAuto)"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
        {/* vitres */}
        <path
          d="M84 16 C102 14.5, 120 16, 132 21 L124 22 C110 18, 96 17, 84 16 Z"
          fill="url(#orAuto)"
        />
        {/* roues */}
        <circle cx="62" cy="38" r="9" stroke="url(#orAuto)" strokeWidth="2.5" fill="none" />
        <circle cx="62" cy="38" r="3.5" fill="url(#orAuto)" />
        <circle cx="168" cy="38" r="9" stroke="url(#orAuto)" strokeWidth="2.5" fill="none" />
        <circle cx="168" cy="38" r="3.5" fill="url(#orAuto)" />
        {/* sabre lumineux sous la voiture */}
        <path d="M8 44 C70 40, 150 40, 212 44" stroke="url(#orAuto)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {/* Wordmark */}
      <span
        className={cn(
          "titre-or font-black tracking-wide leading-none",
          compact ? "text-xl" : "text-3xl"
        )}
      >
        AUTO<span className="text-[#d6b66f]" style={{ WebkitTextFillColor: "#d6b66f" }}>+</span>
      </span>

      {!compact && (
        <span className="text-[9px] tracking-[0.42em] uppercase text-[#f8ecc9]/70 mt-1">
          Automotive Management
        </span>
      )}
    </div>
  );
}
