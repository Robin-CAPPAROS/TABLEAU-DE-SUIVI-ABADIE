export default function PageAVenir({ titre }: { titre: string }) {
  return (
    <section>
      <h2 className="text-xl font-bold">{titre}</h2>
      <p className="mt-2 text-sm text-gris">Cette page sera disponible prochainement.</p>
    </section>
  );
}
