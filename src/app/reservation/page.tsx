"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import { formatMad } from "@/lib/catalogue-test";

type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_min: number;
  is_active: boolean;
  establishment_id: string;
};

export default function ReservationPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{
    service_id: string;
    vehicle_id: string;
    client_name: string;
    client_phone: string;
    client_email: string;
    client_address: string;
    slot_start: string;
    slot_end: string;
    notes: string;
    establishment_id: string;
    client_id: string;
    duration_min: number;
  }>({
    service_id: "",
    vehicle_id: "",
    client_name: "",
    client_phone: "",
    client_email: "",
    client_address: "",
    slot_start: "",
    slot_end: "",
    notes: "",
    establishment_id: "",
    client_id: "",
    duration_min: 60,
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les services actifs
  useEffect(() => {
    const loadServices = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("services").select("*").eq("is_active", true).order("name");
      if (!error && data?.length) {
        setServices(data as Service[]);
      }
      setLoading(false);
    };
    loadServices();
  }, []);

  // Mise à jour du formulaire
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Sélecteur de service
  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const serviceId = e.target.value;
    setForm((prev) => ({
      ...prev,
      service_id: serviceId,
      establishment_id: services.find((s) => s.id === serviceId)?.establishment_id ?? prev.establishment_id,
      duration_min: services.find((s) => s.id === serviceId)?.duration_min ?? prev.duration_min,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.service_id || !form.slot_start || !form.client_name) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setError(null);

    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }

    try {
      const durationMinutes = form.duration_min || 60;
      const slotStart = new Date(form.slot_start);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

      const { error: dbError } = await supabase.from("appointments").insert({
        establishment_id: form.establishment_id,
        client_id: form.client_id,
        vehicle_id: form.vehicle_id,
        service_id: form.service_id,
        slot_start: slotStart.toISOString(),
        slot_end: slotEnd.toISOString(),
        channel: "online",
        status: "pending",
        notes: form.notes,
      });

      if (dbError) throw dbError;

      setSuccess(true);
      setForm({
        service_id: "",
        vehicle_id: "",
        client_name: "",
        client_phone: "",
        client_email: "",
        client_address: "",
        slot_start: "",
        slot_end: "",
        notes: "",
        establishment_id: "",
        client_id: "",
        duration_min: 60,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la réservation.");
    }
  };

  if (loading) {
    return <p className="text-center text-[#a8bb87]">Chargement des services...</p>;
  }

  return (
    <section className="max-w-2xl mx-auto p-6">
      <h1 className="titre-or mb-6 text-2xl font-extrabold">Réservation en ligne</h1>

      <p className="text-[#a8bb87] mb-4">
        Prenez rendez-vous directement depuis votre navigateur. Remplissez le formulaire ci-dessous.
      </p>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      {success ? (
        <div className="mb-6 p-4 bg-[#21464b]/50 rounded-lg">
          <p className="text-[#a8bb87]">Réservation confirmée !</p>
          <p className="mt-2">Vous recevrez une confirmation par email.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a8bb87] mb-1">Service</label>
              <select
                name="service_id"
                required
                onChange={handleServiceChange}
                className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
              >
                <option value="">Sélectionner un service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - {formatMad(s.price)} MAD ({s.duration_min} min)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#a8bb87] mb-1">Véhicule</label>
              <select
                name="vehicle_id"
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
              >
                <option value="">Aucun véhicule</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#a8bb87] mb-1">Coordonnées du client</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                name="client_name"
                required
                value={form.client_name}
                onChange={handleInputChange}
                placeholder="Nom complet"
                className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
              />
              <input
                type="tel"
                name="client_phone"
                value={form.client_phone}
                onChange={handleInputChange}
                placeholder="Téléphone"
                className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
              />
            </div>
            <input
              type="email"
              name="client_email"
              required
              value={form.client_email}
              onChange={handleInputChange}
              placeholder="Email"
              className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
            />
            <input
              type="text"
              name="client_address"
              value={form.client_address}
              onChange={handleInputChange}
              placeholder="Adresse"
              className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
            />
          </div>

          <div>
            <label className="block text-sm text-[#a8bb87] mb-1">Date et heure</label>
            <div>
              <input
                type="date"
                name="slot_start"
                required
                value={form.slot_start}
                onChange={(e) => setForm({ ...form, slot_start: e.target.value })}
                className="champ w-full min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="time"
                  name="slot_end"
                  value={form.slot_end}
                  onChange={(e) => setForm({ ...form, slot_end: e.target.value })}
                  className="champ min-h-11 rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
                />
                <span className="text-xs text-[#a8bb87]">
                  Durée : {form.duration_min} min
                </span>
              </div>
            </div>
            <small className="text-xs text-[#a8bb87]">
              Veuillez sélectionner une date et heure disponible. Le garage vous contactera pour confirmation.
            </small>
          </div>

          <div>
            <label className="block text-sm text-[#a8bb87] mb-1">Notes supplémentaires</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="champ w-full rounded border border-[#d6b66f]/15 bg-[#193a40] text-[#f8ecc9] placeholder-[#a8bb87]"
              ></textarea>
          </div>

          <button type="submit" className="btn-or w-full py-3 text-sm font-bold">
            {success ? "Réservation effectuée !" : "Envoyer la réservation"}
          </button>
        </form>
      )}
    </section>
  );
}