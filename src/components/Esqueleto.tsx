/** Tela de espera: aparece na hora do toque, enquanto o servidor responde. */
export function Esqueleto({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="esq" aria-busy="true" aria-label="Carregando">
      <span className="esq-b" style={{ width: "38%", height: 26 }} />
      <span className="esq-b" style={{ width: "58%", height: 14 }} />
      <div className="kpis" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}><span className="esq-b" style={{ height: 92 }} /><span className="esq-b" style={{ height: 92 }} /></div>
      {Array.from({ length: linhas }, (_, i) => <span key={i} className="esq-b" style={{ height: 54 }} />)}
    </div>
  );
}
