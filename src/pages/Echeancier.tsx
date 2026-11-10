import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { StatutEcheance, TypeEcheance } from '@domain/types';
import { ajouterJours, dateDuJourParis } from '@domain/dates';
import { useMoi } from '@/auth/SessionProvider';
import { listerCollaborateurs, listerEcheances, type FiltresEcheances } from '@/data/echeances';
import ActionsEcheance from '@/components/ActionsEcheance';
import CalendrierMensuel from '@/components/CalendrierMensuel';
import ExportExcel from '@/components/ExportExcel';
import { StatutEcheanceBadge } from '@/components/StatutBadge';
import { messageErreur } from '@/lib/erreurs';
import { formaterDate } from '@/lib/format';
import { LIBELLES_STATUT, LIBELLES_TYPE } from '@/lib/libelles';
import { cn } from '@/lib/utils';

const CHAMP = 'rounded border border-gris px-2 py-1 text-sm';
const COLONNES = [
  { cle: 'dossier', libelle: 'Dossier' },
  { cle: 'type', libelle: 'Échéance' },
  { cle: 'dateLimite', libelle: 'Date limite' },
  { cle: 'statut', libelle: 'Statut' },
  { cle: 'dateDepot', libelle: 'Date de dépôt' },
  { cle: 'montant', libelle: 'Montant' },
];

export default function Echeancier() {
  const { moi } = useMoi();
  const [type, setType] = useState<TypeEcheance | ''>('');
  const [statut, setStatut] = useState<StatutEcheance | ''>('');
  const [collaborateurId, setCollaborateurId] = useState('');
  const [equipe, setEquipe] = useState('');
  // Période par défaut : J-60 à J+120 (modifiable et effaçable).
  const [du, setDu] = useState(() => ajouterJours(dateDuJourParis(new Date()), -60));
  const [au, setAu] = useState(() => ajouterJours(dateDuJourParis(new Date()), 120));
  const [mesDossiers, setMesDossiers] = useState(true);
  const [vue, setVue] = useState<'liste' | 'calendrier'>('liste');

  const filtres: FiltresEcheances = {
    types: type ? [type] : undefined,
    statuts: statut ? [statut] : undefined,
    collaborateurId: collaborateurId || undefined,
    equipe: equipe === '' ? undefined : Number(equipe),
    du: du || undefined,
    au: au || undefined,
    mesDossiers,
  };

  const { data: lignes = [], isLoading, error } = useQuery({
    queryKey: ['echeances', filtres, moi?.id],
    enabled: !!moi,
    queryFn: () => listerEcheances(filtres, moi!.id),
  });
  const { data: collaborateurs = [] } = useQuery({ queryKey: ['collaborateurs'], queryFn: listerCollaborateurs });

  if (!moi) return null;

  const exportables = lignes.map((l) => ({
    dossier: l.raison_sociale,
    type: LIBELLES_TYPE[l.type],
    dateLimite: formaterDate(l.date_limite),
    statut: LIBELLES_STATUT[l.statut],
    dateDepot: l.date_depot ? formaterDate(l.date_depot) : '',
    montant: l.montant ?? '',
  }));

  return (
    <section className="space-y-4 font-cabinet">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-marine">Échéancier</h2>
        <div className="flex gap-2">
          {(['liste', 'calendrier'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={vue === v}
              onClick={() => setVue(v)}
              className={cn('rounded px-3 py-1.5 text-sm font-bold', vue === v ? 'bg-primaire text-white' : 'border border-gris text-marine')}
            >
              {v === 'liste' ? 'Liste' : 'Calendrier'}
            </button>
          ))}
          <ExportExcel nomFichier="echeancier" colonnes={COLONNES} lignes={exportables} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border border-gris/60 p-3">
        <label className="flex flex-col text-xs font-bold">
          Type
          <select className={CHAMP} value={type} onChange={(e) => setType(e.target.value as TypeEcheance | '')}>
            <option value="">Tous</option>
            {(Object.keys(LIBELLES_TYPE) as TypeEcheance[]).map((t) => (
              <option key={t} value={t}>{LIBELLES_TYPE[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-bold">
          Statut
          <select className={CHAMP} value={statut} onChange={(e) => setStatut(e.target.value as StatutEcheance | '')}>
            <option value="">Tous</option>
            {(Object.keys(LIBELLES_STATUT) as StatutEcheance[]).map((s) => (
              <option key={s} value={s}>{LIBELLES_STATUT[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-bold">
          Collaborateur
          <select className={CHAMP} value={collaborateurId} onChange={(e) => setCollaborateurId(e.target.value)}>
            <option value="">Tous</option>
            {collaborateurs.map((c) => (
              <option key={c.id} value={c.id}>{c.trigramme} ({c.prenom} {c.nom})</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs font-bold">
          Équipe
          <input type="number" min={1} className={cn(CHAMP, 'w-20')} value={equipe} onChange={(e) => setEquipe(e.target.value)} />
        </label>
        <label className="flex flex-col text-xs font-bold">
          Du
          <input type="date" className={CHAMP} value={du} onChange={(e) => setDu(e.target.value)} />
        </label>
        <label className="flex flex-col text-xs font-bold">
          Au
          <input type="date" className={CHAMP} value={au} onChange={(e) => setAu(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={mesDossiers} onChange={(e) => setMesDossiers(e.target.checked)} />
          Mes dossiers
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{messageErreur(error, 'Chargement impossible.')}</p>}
      {isLoading && <p className="text-sm text-gris">Chargement…</p>}

      {vue === 'calendrier' ? (
        <CalendrierMensuel lignes={lignes} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-marine text-white">
              <tr>
                <th className="p-2">Dossier</th>
                <th className="p-2">Échéance</th>
                <th className="p-2">Date limite</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-gris/40 align-top">
                  <td className="p-2 font-bold">
                    <Link to={`/dossiers/${l.dossier_id}`} className="text-primaire hover:underline">{l.raison_sociale}</Link>
                  </td>
                  <td className="p-2">
                    {LIBELLES_TYPE[l.type]}
                    {l.synchronisee && <span className="ml-2 rounded border border-gris px-1 text-xs text-marine">Pennylane</span>}
                  </td>
                  <td className="p-2">{formaterDate(l.date_limite)}</td>
                  <td className="p-2"><StatutEcheanceBadge echeance={l} /></td>
                  <td className="p-2"><ActionsEcheance echeance={l} moi={moi} /></td>
                </tr>
              ))}
              {!isLoading && lignes.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gris">Aucune échéance pour ces filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
