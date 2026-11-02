import { ChevronIcon } from "./Icons";
import { capitalize, dayKey, sameDay } from "../lib/dates";

const DOW = ["L", "M", "X", "J", "V", "S", "D"];

// Calendario mensual estilo iOS. La semana empieza en lunes.
export default function Calendar({ month, onMonthChange, selected, onSelect, today }) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const isCurrentMonth = year === today.getFullYear() && m === today.getMonth();

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));

  const title = capitalize(
    first.toLocaleDateString("es", { month: "long", year: "numeric" })
  );

  return (
    <div className="calendar">
      <div className="cal-head">
        <span className="cal-title">{title}</span>
        <div className="cal-nav">
          <button
            className="icon-btn"
            onClick={() => onMonthChange(new Date(year, m - 1, 1))}
            aria-label="Mes anterior"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            className="icon-btn"
            onClick={() => onMonthChange(new Date(year, m + 1, 1))}
            disabled={isCurrentMonth}
            aria-label="Mes siguiente"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {DOW.map((d) => (
          <span key={d} className="cal-dow">
            {d}
          </span>
        ))}
        {cells.map((date, i) =>
          date ? (
            <button
              key={dayKey(date)}
              className={
                "cal-day" +
                (sameDay(date, selected) ? " selected" : "") +
                (sameDay(date, today) ? " today" : "")
              }
              disabled={date > today}
              onClick={() => onSelect(date)}
            >
              {date.getDate()}
            </button>
          ) : (
            <span key={`e${i}`} />
          )
        )}
      </div>
    </div>
  );
}
