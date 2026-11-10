import { useQuery } from '@tanstack/react-query';
import { derniereSynchro } from '@/data/synchro';
import { formaterDateHeureParis } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEUIL_MS = 48 * 3600 * 1000;

export default function BandeauSynchro() {
  const { data, isSuccess } = useQuery({ queryKey: ['derniere-synchro'], queryFn: derniereSynchro });
  if (!isSuccess) return null;

  let texte: string;
  let alerte = false;
  if (data === null) {
    texte = 'Aucune synchronisation Pennylane enregistrée';
    alerte = true;
  } else if (Date.now() - new Date(data).getTime() > SEUIL_MS) {
    texte = 'Synchronisation Pennylane interrompue depuis plus de 48 heures';
    alerte = true;
  } else {
    texte = `Dernière synchronisation Pennylane : ${formaterDateHeureParis(data)}`;
  }

  return (
    <div
      role={alerte ? 'alert' : 'status'}
      className={cn('px-4 py-2 text-sm', alerte ? 'bg-red-600 font-bold text-white' : 'bg-gris/20 text-marine')}
    >
      {texte}
    </div>
  );
}
