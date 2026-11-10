import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dateDuJourParis } from '@domain/dates';
import type { LigneEcheance, Moi } from '@/data/types';
import { peutAgirSurEcheance } from '@/auth/permissions';
import { confirmerPaiement, marquerEcheance, qualifierRetard } from '@/data/echeances';
import { LIBELLES_CAUSE } from '@/lib/libelles';
import type { CauseRetard } from '@/data/types';

const BOUTON = 'rounded border border-primaire px-2 py-1 text-xs font-bold text-primaire hover:bg-primaire/10';

export default function ActionsEcheance({ echeance: e, moi }: { echeance: LigneEcheance; moi: Moi }) {
  const client = useQueryClient();
  const [saisie, setSaisie] = useState(false);
  const [date, setDate] = useState(() => dateDuJourParis(new Date()));
  const [montant, setMontant] = useState('');
  const [erreurMontant, setErreurMontant] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSuccess: () => {
      setSaisie(false);
      return Promise.all([
        client.invalidateQueries({ queryKey: ['echeances'] }),
        client.invalidateQueries({ queryKey: ['accueil'] }),
      ]);
    },
  });

  const peut = peutAgirSurEcheance(moi, e);
  if (!peut) return null;

  const manuelle = !e.synchronisee;
  const enregistrer = () => {
    const brut = montant.trim().replace(',', '.');
    const m = brut === '' ? undefined : Number(brut);
    if (m !== undefined && !Number.isFinite(m)) {
      setErreurMontant('Montant invalide : saisissez un nombre.');
      return;
    }
    setErreurMontant(null);
    mutation.mutate(() => marquerEcheance(e.id, 'depose', date, m));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {manuelle && e.statut === 'a_faire' && (
          <>
            <button type="button" className={BOUTON} onClick={() => setSaisie((v) => !v)}>
              Marquer déposé
            </button>
            <button type="button" className={BOUTON} onClick={() => mutation.mutate(() => marquerEcheance(e.id, 'non_applicable'))}>
              Non applicable
            </button>
          </>
        )}
        {manuelle && (e.statut === 'depose' || e.statut === 'non_applicable') && (
          <button type="button" className={BOUTON} onClick={() => mutation.mutate(() => marquerEcheance(e.id, 'a_faire'))}>
            Remettre à faire
          </button>
        )}
        {e.alerte_paiement && (
          <button type="button" className={BOUTON} onClick={() => mutation.mutate(() => confirmerPaiement(e.id))}>
            Confirmer le paiement
          </button>
        )}
        {e.depot_tardif && (
          <select
            aria-label="Qualifier la cause du retard"
            className="rounded border border-gris px-1 py-1 text-xs"
            value={e.cause_retard ?? ''}
            onChange={(ev) => {
              const cause = ev.target.value as CauseRetard;
              if (cause) mutation.mutate(() => qualifierRetard(e.id, cause));
            }}
          >
            <option value="">Qualifier la cause du retard</option>
            {(Object.keys(LIBELLES_CAUSE) as CauseRetard[]).map((c) => (
              <option key={c} value={c}>{LIBELLES_CAUSE[c]}</option>
            ))}
          </select>
        )}
      </div>
      {saisie && (
        <form
          className="flex flex-wrap items-end gap-2 rounded border border-gris p-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            enregistrer();
          }}
        >
          <label className="flex flex-col text-xs">
            Date de dépôt
            <input type="date" required value={date} onChange={(ev) => setDate(ev.target.value)} className="rounded border border-gris px-1 py-1" />
          </label>
          <label className="flex flex-col text-xs">
            Montant (facultatif)
            <input type="text" inputMode="decimal" value={montant} onChange={(ev) => setMontant(ev.target.value)} className="w-28 rounded border border-gris px-1 py-1" />
          </label>
          {erreurMontant && <p role="alert" className="w-full text-xs text-red-600">{erreurMontant}</p>}
          <button type="submit" className="rounded bg-primaire px-2 py-1 text-xs font-bold text-white" disabled={mutation.isPending}>
            Enregistrer le dépôt
          </button>
        </form>
      )}
      {mutation.isError && (
        <p role="alert" className="text-xs text-red-600">
          {mutation.error instanceof Error ? mutation.error.message : "L'action a échoué."}
        </p>
      )}
    </div>
  );
}
