import { cn } from '@/lib/utils';

export type Tonalite = 'neutre' | 'info' | 'succes' | 'alerte';

const STYLES: Record<Tonalite, string> = {
  neutre: 'bg-gris/30 text-marine',
  info: 'bg-primaire text-white',
  succes: 'bg-green-600 text-white',
  alerte: 'bg-red-600 text-white',
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
