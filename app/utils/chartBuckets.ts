/**
 * barber arma "citas completadas del mes" (clientTrends) en 12 tramos de 3 días desde el
 * inicio del mes, con etiquetas "d M" en inglés ("25 Sep"); los últimos caen en el mes
 * siguiente. Esta función quita los tramos que todavía no ocurren, para que la gráfica no
 * caiga a 0 en fechas futuras.
 */
const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

export function untilToday(labels: string[], values: number[], today = new Date()): { labels: string[]; values: number[] } {
  const keep = labels.map((label) => {
    const [day, mon] = label.split(" ");
    const month = MONTHS[mon ?? ""];
    if (month === undefined || !day) return true;
    const date = new Date(today.getFullYear(), month, Number(day));
    // Tramo de enero visto en diciembre: es del año siguiente.
    if (month < today.getMonth() - 6) date.setFullYear(today.getFullYear() + 1);

    return date <= today;
  });

  return { labels: labels.filter((_, i) => keep[i]), values: values.filter((_, i) => keep[i]) };
}
