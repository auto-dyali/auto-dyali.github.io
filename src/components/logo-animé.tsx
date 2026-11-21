"use client";

/**
 * AUTO DYALI — Logo animé (SVG premium)
 *
 * Utilisé dans les communications WhatsApp et e-mail.
 * - Animation légère et professionnelle (scintillement or/champagne)
 * - Identité : noir profond + or champagne
 * - Version statique intégrée en fallback pour les clients qui ne supportent pas l'animation SVG
 */

export function LogoAnime({
  width = 120,
  height = 120,
  className = "",
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={className} style={{ width, height, display: "inline-block" }}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Logo AUTO DYALI"
      >
        <defs>
          <linearGradient id="grad-or" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#D0C6AE", stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: "#F0DCae", stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: "#D0C6AE", stopOpacity: 1 }} />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Fond noir profond */}
        <rect width="200" height="200" rx="24" fill="#0a1210" />

        {/* Silhouette de voiture stylisée (or champagne) */}
        <path
          d="M30 120h140v40H30z"
          fill="#2a3a35"
        />
        <path
          d="M40 110h120v10H40z"
          fill="#1a2420"
        />
        <path
          d="M60 90h80v20H60z"
          fill="#2a3a35"
        />
        {/* Roues */}
        <circle cx="70" cy="130" r="10" fill="#1a2420" />
        <circle cx="70" cy="130" r="4" fill="#8FB59B" />
        <circle cx="130" cy="130" r="10" fill="#1a2420" />
        <circle cx="130" cy="130" r="4" fill="#8FB59B" />

        {/* Wordmark "AUTO DYALI" */}
        <text
          x="100"
          y="75"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="24"
          font-weight="900"
          letter-spacing="4"
          fill="url(#grad-or)"
          filter="url(#glow)"
        >
          AUTO DYALI
        </text>

        {/* Sous-titre */}
        <text
          x="100"
          y="100"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="10"
          letter-spacing="2"
          fill="#8FB59B"
        >
          SERVICE AUTOMOBILE PREMIUM
        </text>

        {/* Animation de scintillement or */}
        <animate
          attributeName="opacity"
          values="0.85;1;0.85"
          dur="3s"
          repeatCount="indefinite"
        />
      </svg>

      {/* Version statique de remplacement (fallback) — affichée si l'animation n'est pas supportée */}
      <img
        src="/images/branding/logo.webp"
        alt="AUTO DYALI"
        style={{
          display: "none",
          width,
          height,
          objectFit: "contain",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
