import { EstadoPostulacion } from "@/lib/bolsa-laboral/types";

const badgeClassMap: Record<EstadoPostulacion, string> = {
  enviada: "badge-blue",
  vista: "badge-yellow",
  seleccionada: "badge-green",
  descartada: "badge-red",
};

const labelMap: Record<EstadoPostulacion, string> = {
  enviada: "Enviada",
  vista: "Vista",
  seleccionada: "Seleccionada",
  descartada: "Descartada",
};

interface PostulacionBadgeProps {
  estado: EstadoPostulacion;
}

export function PostulacionBadge({ estado }: PostulacionBadgeProps) {
  return (
    <span className={badgeClassMap[estado] ?? "badge-gray"}>
      {labelMap[estado] ?? estado}
    </span>
  );
}
