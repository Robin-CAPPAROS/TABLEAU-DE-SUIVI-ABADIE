import type { ReactNode } from 'react';

type Requete = { isLoading: boolean; error: unknown };

/** Bloc avec titre : gère les états chargement, erreur et vide autour du contenu. */
export default function Bloc({ titre, requetes = [], children, vide }: { titre: string; requetes?: Requete[]; children?: ReactNode; vide?: boolean }) {
  const erreur = requetes.find((r) => r.error)?.error;
  const chargement = requetes.some((r) => r.isLoading);
  let corps: ReactNode = children;
  if (erreur) {
    corps = <p role="alert" className="text-sm text-red-600">{erreur instanceof Error ? erreur.message : 'Chargement impossible.'}</p>;
  } else if (chargement) {
    corps = <p className="text-sm text-gris">Chargement…</p>;
  } else if (vide) {
    corps = <p className="text-sm text-gris">Rien à signaler.</p>;
  }
  return (
    <section className="rounded border border-gris/60 bg-white p-4">
      <h3 className="mb-2 text-base font-bold text-marine">{titre}</h3>
      {corps}
    </section>
  );
}
