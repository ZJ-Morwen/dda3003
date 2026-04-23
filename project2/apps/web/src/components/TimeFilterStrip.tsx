import type { TimeFilter } from "../../../../shared/contracts";

interface TimeFilterStripProps {
  anchorDate: string;
  value: TimeFilter;
  onChange: (next: TimeFilter) => void;
}

function buildRecentDays(anchorDate: string): string[] {
  const anchor = new Date(`${anchorDate}T00:00:00+08:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

export function TimeFilterStrip({ anchorDate, value, onChange }: TimeFilterStripProps) {
  const days = buildRecentDays(anchorDate);
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>时间过滤</h3>
        <p>最近 7 个自然日</p>
      </div>
      <div className="date-strip">
        {days.map((day) => {
          const active = value.startDay === day && (value.endDay ?? value.startDay) === day;
          return (
            <button
              key={day}
              type="button"
              className={`date-pill ${active ? "active" : ""}`}
              onClick={() => onChange({ mode: "single_day", startDay: day })}
            >
              <span>{day.slice(5)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
