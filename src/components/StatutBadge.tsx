import type { StatutEcheance } from '@domain/types';
import { cn } from '@/lib/utils';
import { LIBELLES_STATUT } from '@/lib/libelles';

export type Tonalite = 'neutre' | 'info' | 'succes' | 'alerte' | 'orange' | 'violet';

const STYLES: Record<Tonalite, string> = {
  neutre: 'bg-gris/30 text-marine',
  info: 'bg-primaire text-white',
  succes: 'bg-green-600 text-white',
  alerte: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
  violet: 'bg-purple-600 text-white',
};

export default function StatutBadge({
  libelle,
  tonalite = 'neutre',
  className,
}: {
  libelle: string;
  tonalite?: Tonalite;
  className?: string;
}) {
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-bold', STYLES[tonalite], className)}>
      {libelle}
    </span>
  );
}

type EtatEcheance = {
  statut: StatutEcheance;
  en_retard: boolean;
  sous_7_jours: boolean;
  alerte_paiement: boolean;
};

/** Code couleur de l'échéancier : paiement non constaté (violet), en retard (rouge), sous 7 jours (orange), etc. */
export function descripteurEcheance(e: EtatEcheance): { libelle: string; tonalite: Tonalite } {
  if (e.alerte_paiement) return { libelle: 'Paiement non constaté', tonalite: 'violet' };
  if (e.en_retard) return { libelle: 'En retard', tonalite: 'alerte' };
  if (e.sous_7_jours) return { libelle: 'Sous 7 jours', tonalite: 'orange' };
  const tonalite: Tonalite =
    e.statut === 'a_faire' ? 'info' : e.statut === 'non_applicable' ? 'neutre' : 'succes';
  return { libelle: LIBELLES_STATUT[e.statut], tonalite };
}

export function StatutEcheanceBadge({ echeance, className }: { echeance: EtatEcheance; className?: string }) {
  const d = descripteurEcheance(echeance);
  return <StatutBadge libelle={d.libelle} tonalite={d.tonalite} className={className} />;
}
