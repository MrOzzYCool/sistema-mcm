/**
 * Calcula el próximo lunes a partir de una fecha dada.
 * Si la fecha ya es lunes, la devuelve tal cual.
 */
export function proximoLunes(desde: Date = new Date()): string {
  const d = new Date(desde);
  const dia = d.getDay(); // 0=dom, 1=lun, ..., 6=sab
  if (dia === 1) return d.toISOString().split("T")[0]; // ya es lunes
  const diasHastaLunes = dia === 0 ? 1 : 8 - dia; // dom→1, mar→6, mie→5, etc.
  d.setDate(d.getDate() + diasHastaLunes);
  return d.toISOString().split("T")[0];
}

/**
 * Verifica si una fecha cae en lunes.
 */
export function esLunes(fecha: string): boolean {
  return new Date(fecha + "T00:00:00").getDay() === 1;
}
