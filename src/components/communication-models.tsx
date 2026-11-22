 "use client";

/**
 * AUTO DYALI — Modèles de communication (email / WhatsApp)
 *
 * Modèles premium pour l'invitation Manager et l'activation de compte.
 * Aucun secret fournisseur n'est manipulé ici : uniquement le rendu HTML/texte.
 * L'envoi réel est géré par les Edge Functions (onboard-tenant, send-invitation)
 * avec les secrets configurés côté serveur (Resend, WhatsApp Business).
 */

import { LogoAnime } from "@/components/logo-animé";

const DEVISE = "MAD";
const ACTIVATION_BASE_URL =
  process.env.NEXT_PUBLIC_ACTIVATION_BASE_URL ?? "https://auto-dyali.staging.local";

/**
 * Modèle HTML premium pour l'e-mail d'invitation / activation Manager.
 * Compatible clients e-mail : mise en page en tables, CSS en ligne.
 */
export function ModeleEmailInvitation({
  etablissement,
  plan,
  managerNom,
  managerLogin,
  lienActivation,
  dateEcheance,
  dateFinEssai,
}: {
  etablissement: { nom: string; slug: string };
  plan: { code: string; label: string };
  managerNom: string;
  managerLogin: string;
  lienActivation: string;
  dateEcheance: string | null;
  dateFinEssai: string | null;
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Votre compte AUTO DYALI est prêt</title>
</head>
<body style="margin:0;padding:0;background:#0a1210;font-family:Arial,Helvetica,sans-serif;color:#e8ece8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a1210;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Logo animé AUTO DYALI -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center">
              <div style="display:inline-block;width:120px;height:120px;">
                <svg width="120" height="120" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo AUTO DYALI">
                  <defs>
                    <linearGradient id="grad-or" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#D0C6AE;stop-opacity:1" />
                      <stop offset="50%" style="stop-color:#F0DCae;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#D0C6AE;stop-opacity:1" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <rect width="200" height="200" rx="24" fill="#0a1210" />
                  <path d="M30 120h140v40H30z" fill="#2a3a35" />
                  <path d="M40 110h120v10H40z" fill="#1a2420" />
                  <path d="M60 90h80v20H60z" fill="#2a3a35" />
                  <circle cx="70" cy="130" r="10" fill="#1a2420" />
                  <circle cx="70" cy="130" r="4" fill="#8FB59B" />
                  <circle cx="130" cy="130" r="10" fill="#1a2420" />
                  <circle cx="130" cy="130" r="4" fill="#8FB59B" />
                  <text x="100" y="75" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="900" letter-spacing="4" fill="url(#grad-or)" filter="url(#glow)">AUTO DYALI</text>
                  <text x="100" y="100" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="2" fill="#8FB59B">SERVICE AUTOMOBILE PREMIUM</text>
                  <animate attributeName="opacity" values="0.85;1;0.85" dur="3s" repeatCount="indefinite" />
                </svg>
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;">
          <tr>
            <td align="center" style="padding:32px 16px;background:#1a2420;border-radius:24px;">
              <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1px;">
                Bonjour ${managerNom},
              </h1>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#a7b7a8;">
                Votre compte Manager a été créé pour l'établissement <strong>${etablissement.nom}</strong> (${etablissement.slug}).
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#2a3a35;border-radius:16px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Établissement</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${etablissement.nom}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Identifiant de connexion</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;word-break:break-all;">${managerLogin}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Forfait</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${plan.label}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Période d'essai</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${dateFinEssai ? dateFinEssai : "Aucun"}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Échéance payante</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${dateEcheance || "—"}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0;">
                <tr>
                  <td align="center">
                    <a href="${lienActivation}" style="display:inline-block;background:linear-gradient(135deg,#8FB59B,#D0C6AE);color:#0a1210;font-weight:900;padding:16px 32px;border-radius:12px;text-decoration:none;font-size:15px;letter-spacing:1px;">
                      Activer mon compte
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 12px 0;font-size:13px;line-height:1.6;color:#a7b7a8;">
                Ce lien est valide 7 jours. Ne le partagez avec personne. Votre mot de passe sera défini lors de la première connexion.
              </p>
              <p style="margin:0;font-size:12px;color:#6b7280;">
                AUTO DYALI — Gestion de garage premium. ${new Date().getFullYear()}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Modèle de texte pour WhatsApp Business.
 * Texte court, émojis, pas de HTML. Le logo est envoyé séparément (image statique).
 */
export function ModeleMessageWhatsapp({
  etablissement,
  plan,
  managerNom,
  managerLogin,
  lienActivation,
  dateEcheance,
  dateFinEssai,
}: {
  etablissement: { nom: string; slug: string };
  plan: { code: string; label: string };
  managerNom: string;
  managerLogin: string;
  lienActivation: string;
  dateEcheance: string | null;
  dateFinEssai: string | null;
}) {
  return `*AUTO DYALI — Votre compte Manager est prêt*

Bonjour *${managerNom}*,

Votre compte Manager a été créé pour l'établissement *${etablissement.nom}* (*${etablissement.slug}*).

*Détails de votre abonnement :*
• Forfait : *${plan.label}*
• Identifiant de connexion : *${managerLogin}*
• Période d'essai : ${dateFinEssai || "Aucun"}
• Échéance payante : ${dateEcheance || "—"}

*Activation :*
Cliquez sur le lien ci-dessous pour définir votre mot de passe et accéder à votre établissement :
${lienActivation}

Ce lien est valide 7 jours. Ne le partagez avec personne.

AUTO DYALI — Service automobile premium`;
}

/**
 * Modèle HTML pour l'e-mail de confirmation administrative (Super Admin).
 * Confirmation de création du garage et de son abonnement.
 */
export function ModeleEmailAdminConfirmation({
  etablissement,
  plan,
  managerNom,
  managerLogin,
  dateCreation,
}: {
  etablissement: { nom: string; slug: string };
  plan: { code: string; label: string };
  managerNom: string;
  managerLogin: string;
  dateCreation: string;
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouveau garage créé — AUTO DYALI</title>
</head>
<body style="margin:0;padding:0;background:#0a1210;font-family:Arial,Helvetica,sans-serif;color:#e8ece8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a1210;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <div style="display:inline-block;width:100px;height:100px;">
          <svg width="100" height="100" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo AUTO DYALI">
            <defs>
              <linearGradient id="grad-or" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#D0C6AE;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#F0DCae;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#D0C6AE;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="200" height="200" rx="24" fill="#0a1210" />
            <path d="M30 120h140v40H30z" fill="#2a3a35" />
            <path d="M40 110h120v10H40z" fill="#1a2420" />
            <path d="M60 90h80v20H60z" fill="#2a3a35" />
            <circle cx="70" cy="130" r="10" fill="#1a2420" />
            <circle cx="70" cy="130" r="4" fill="#8FB59B" />
            <circle cx="130" cy="130" r="10" fill="#1a2420" />
            <circle cx="130" cy="130" r="4" fill="#8FB59B" />
            <text x="100" y="75" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="900" letter-spacing="3" fill="url(#grad-or)">AUTO DYALI</text>
          </svg>
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;">
          <tr>
            <td align="center" style="padding:24px 16px;background:#1a2420;border-radius:24px;">
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:900;color:#ffffff;">
                Nouveau garage créé
              </h1>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#a7b7a8;">
                Le garage a été créé avec succès. Un compte Manager a été associé et une invitation a été préparée.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;background:#2a3a35;border-radius:16px;">
                <tr>
                  <td style="padding:16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Établissement</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${etablissement.nom}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Slug</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;word-break:break-all;">${etablissement.slug}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Forfait</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${plan.label}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Manager</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${managerNom}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Identifiant Manager</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;word-break:break-all;">${managerLogin}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-size:13px;color:#a7b7a8;">Date de création</td>
                        <td style="padding:8px 0;font-size:14px;font-weight:bold;color:#e8ece8;text-align:right;">${dateCreation}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#6b7280;">
                AUTO DYALI — Gestion de garage premium. ${new Date().getFullYear()}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
