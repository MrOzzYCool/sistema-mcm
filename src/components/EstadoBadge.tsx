export function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    pagado:     "badge-green",
    pendiente:  "badge-yellow",
    vencido:    "badge-red",
    en_proceso: "badge-blue",
    aprobado:   "badge-green",
    rechazado:  "badge-red",
  };
  const labels: Record<string, string> = {
    pagado:     "Pagado",
    pendiente:  "Pendiente",
    vencido:    "Vencido",
    en_proceso: "En proceso",
    aprobado:   "Aprobado",
    rechazado:  "Rechazado",
  };
  return <span className={map[estado] ?? "badge-gray"}>{labels[estado] ?? estado}</span>;
}
