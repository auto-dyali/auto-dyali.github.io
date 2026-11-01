-- =====================================================================
-- AUTO+ — Données de démonstration locales (fidèles à la maquette)
-- Sera exécuté après la migration sur la base fournie.
-- =====================================================================

-- Établissement principal
insert into establishments (id, name, slug, city, phone) values
  ('00000000-0000-0000-0000-000000000001', 'Garage Auto+ Casablanca', 'auto-plus-casa', 'Casablanca', '+212 5 22 00 00 00')
on conflict (slug) do nothing;

-- Employés / équipe de la maquette
insert into employees (id, establishment_id, code, full_name, job_title) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001', 'EMP-001', 'Mohamed Mechanic', 'Mécanicien senior'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000001', 'EMP-002', 'Karim Diesel', 'Mécanicien'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000001', 'EMP-003', 'Youssef Auto', 'Technicien diagnostic'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000001', 'EMP-004', 'Hajar Store', 'Responsable stock')
on conflict do nothing;

-- Clients
insert into clients (id, establishment_id, code, full_name, phone, city) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-000000000001','CL-0001','Ahmed Belkacem','+212 661 000 001','Casablanca'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-000000000001','CL-0002','Fatima Zahra','+212 661 000 002','Casablanca'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-000000000001','CL-0003','Rachid Alaoui','+212 661 000 003','Mohammedia'),
  ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-000000000001','CL-0004','Sanae Bennis','+212 661 000 004','Casablanca'),
  ('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-000000000001','CL-0005','Omar Tazi','+212 661 000 005','Casablanca')
on conflict do nothing;

-- Véhicules du panneau « Véhicules en atelier » de la maquette
insert into vehicles (id, establishment_id, client_id, plate, brand, model, year, status) values
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','12345-A-5','Toyota','Corolla',2021,'in_atelier'),
  ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c2','98765-B-1','Renault','Clio',2019,'in_atelier'),
  ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c3','45678-C-9','Dacia','Sandero',2020,'in_atelier'),
  ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c4','32101-D-3','Peugeot','208',2022,'in_atelier'),
  ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c5','77788-E-2','BMW','Série 3',2023,'in_atelier')
on conflict do nothing;

-- Services (correspondant au donut « CA par service »)
insert into services (establishment_id, name, category, price, duration_min) values
  ('00000000-0000-0000-0000-000000000001','Vidange + filtre','vidange',350,45),
  ('00000000-0000-0000-0000-000000000001','Changement pneus','pneumatiques',600,60),
  ('00000000-0000-0000-0000-000000000001','Plaquettes de frein','freinage',800,90),
  ('00000000-0000-0000-0000-000000000001','Réparation moteur','reparation',2500,240),
  ('00000000-0000-0000-0000-000000000001','Diagnostic électronique','diagnostic',300,30);

-- Interventions du tableau de bord employé (OR-2025-045/046/047)
insert into work_orders (id, establishment_id, reference, vehicle_id, client_id, assigned_to, status, diagnosis) values
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000001','OR-2025-045','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000e1','in_progress','Vidange + filtre à huile'),
  ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000001','OR-2025-046','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e3','pending','Diagnostic volant de direction'),
  ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000001','OR-2025-047','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000e2','pending','Pneumatiques avant à remplacer');
