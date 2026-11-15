"use client";

type ClientDetail = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  code: string | null;
  is_active: boolean;
  role: string;
  establishment_id: string | null;
};

export function SuperAdminClientDetailModal({
  client,
  onClose,
}: {
  client: ClientDetail;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true" aria-label="Fiche client">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[#2C3735] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#A7B7A8]">Fiche client</p>
            <h2 className="titre-or mt-1 text-xl font-extrabold">{client.full_name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-[#A7B7A8]" aria-label="Fermer">×</button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-[#252D2D] p-4 sm:col-span-2">
            <p className="text-xs uppercase text-[#A7B7A8]">ID</p>
            <p className="break-all font-mono text-sm text-[#DFE7E2]">{client.id}</p>
          </div>
          <div className="rounded-lg bg-[#252D2D] p-4">
            <p className="text-xs uppercase text-[#A7B7A8]">Email</p>
            <p className="text-sm text-[#DFE7E2]">{client.email ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-[#252D2D] p-4">
            <p className="text-xs uppercase text-[#A7B7A8]">Téléphone</p>
            <p className="text-sm text-[#DFE7E2]">{client.phone ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-[#252D2D] p-4">
            <p className="text-xs uppercase text-[#A7B7A8]">Code</p>
            <p className="font-mono text-sm text-[#DFE7E2]">{client.code ?? "—"}</p>
          </div>
          <div className="rounded-lg bg-[#252D2D] p-4">
            <p className="text-xs uppercase text-[#A7B7A8]">Statut</p>
            <p className={`text-sm font-semibold ${client.is_active ? "text-[#5D9E7F]" : "text-[#C5716B]"}`}>
              {client.is_active ? "Actif" : "Suspendu"}
            </p>
          </div>
          <div className="rounded-lg bg-[#252D2D] p-4">
            <p className="text-xs uppercase text-[#A7B7A8]">Rôle</p>
            <p className="text-sm capitalize text-[#DFE7E2]">{client.role}</p>
          </div>
          <div className="rounded-lg bg-[#252D2D] p-4">
            <p className="text-xs uppercase text-[#A7B7A8]">Établissement</p>
            <p className="break-all text-sm text-[#DFE7E2]">{client.establishment_id ?? "—"}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[#A7B7A8] hover:bg-[#252D2D]">Fermer</button>
        </div>
      </div>
    </div>
  );
}
