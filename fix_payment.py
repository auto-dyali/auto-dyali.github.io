import re

with open('supabase/migrations/0021_mini_pos.sql', 'r') as f:
    content = f.read()

old_block = '''  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce((v_pay->>'amount')::numeric, 0) > 0 then
      insert into public.payments
        (establishment_id, sale_id, method, amount, received_by)
      values
        (v_est, v_sale, (v_pay->>'method')::public.payment_method,
         (v_pay->>'amount')::numeric, auth.uid());
    end if;
  end loop;

  return v_sale;'''

new_block = '''  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if coalesce((v_pay->>'amount')::numeric, 0) < 0 then raise exception 'Règlement négatif interdit.'; end if;
    if coalesce((v_pay->>'statut')::text, '') <> 'en_attente' then
      v_recu := v_recu + coalesce((v_pay->>'amount')::numeric, 0);
    end if;
  end loop;

  if v_recu > p_paid_total then
    raise exception 'Paiement excédentaire : le montant des règlements (%) dépasse le montant payé (%).', v_recu, p_paid_total;
  end if;

  return v_sale;'''

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    with open('supabase/migrations/0021_mini_pos.sql', 'w') as f:
        f.write(content)
    print('Remplacement effectué avec succès')
else:
    print('Bloc non trouvé')
    lines = content.split('\n')
    for i, line in enumerate(lines[190:202], start=191):
        print(f'{i}: {repr(line)}')