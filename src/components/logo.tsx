import { cn } from "@/lib/utils";

/**
 * Logo AUTO DYALI — identité automobile dorée,
 * silhouette de voiture au-dessus du wordmark « AUTO DYALI »,
 * souligné par un filet doré. Vectoriel (net à toute taille).
 */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const basePath = process.env.NEXT_PUBLIC_SITE_BASE_PATH ?? "";
  return (
    <div className={cn("flex flex-col items-center select-none", className)}>
      <img src={`${basePath}/images/branding/logo.webp`} alt="AUTO DYALI" className={cn("object-contain", compact ? "h-10 w-10" : "h-32 w-32")} />

      {!compact && (
        <span className="text-[9px] tracking-[0.3em] uppercase text-[#A7B7A8]/80 mt-2">
          Votre partenaire automobile de confiance
        </span>
      )}
    </div>
  );
}
