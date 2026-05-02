import type { DataDescriptionCard } from "../../../../shared/contracts";

interface DataCardsProps {
  cards: DataDescriptionCard[];
}

export function DataCards({ cards }: DataCardsProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Data Notes</h3>
        <p>Real, derived, and mock sources are shown separately.</p>
      </div>
      <div className="card-grid">
        {cards.map((card) => (
          <div key={card.title} className="info-card">
            <div className="info-card-top">
              <span>{card.title}</span>
            </div>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
