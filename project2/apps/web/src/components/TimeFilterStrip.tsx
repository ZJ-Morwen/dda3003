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

  const currentDay = value.startDay;
  const currentIndex = Math.max(0, days.indexOf(currentDay));

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextIndex = Number(event.target.value);
    const nextDay = days[nextIndex];

    onChange({
      mode: "single_day",
      startDay: nextDay,
    });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>时间轴</h3>
        <p>拖动滑块查看最近 7 个自然日的航行数据</p>
      </div>

      <div className="time-slider-wrapper">
        <input
          type="range"
          min={0}
          max={days.length - 1}
          step={1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="time-slider"
        />

        <div className="time-slider-labels">
          {days.map((day) => (
            <span
              key={day}
              className={day === currentDay ? "active" : ""}
            >
              {day.slice(5)}
            </span>
          ))}
        </div>

        <div className="selected-time">
          当前日期：<strong>{currentDay}</strong>
        </div>
      </div>
    </div>
  );
}