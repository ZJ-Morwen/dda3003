import type { DataDescriptionCard } from "../../../../shared/contracts";
import { Badge } from "./Badge";

interface DataCardsProps {
  cards: DataDescriptionCard[];
}

export function DataCards({ cards }: DataCardsProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>数据说明</h3>
        <p>真实 / 推导 / 模拟来源分离展示</p>
      </div>
      <div className="card-grid">
        {cards.map((card) => (
          <div key={card.title} className="info-card">
            <div className="info-card-top">
              <span>{card.title}</span>
              <Badge sourceType={card.sourceType} />
            </div>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
