import { useState } from 'react';
import { exporterExcel, type ColonneExport } from '@/lib/exportExcel';

export default function ExportExcel({
  nomFichier,
  colonnes,
  lignes,
}: {
  nomFichier: string;
  colonnes: ColonneExport[];
  lignes: Record<string, unknown>[];
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const exporter = async () => {
    setErreur(null);
    try {
      await exporterExcel(nomFichier, colonnes, lignes);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'export a échoué.");
    }
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={exporter} className="rounded border border-primaire px-3 py-1.5 text-sm font-bold text-primaire hover:bg-primaire/10">
        Exporter en Excel
      </button>
      {erreur && <span role="alert" className="text-xs text-red-600">{erreur}</span>}
    </span>
  );
}
