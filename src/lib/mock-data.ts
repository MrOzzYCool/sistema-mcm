// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Role = "admin" | "alumno";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  carrera: string;
  ciclo: string;
  avatar: string;
}

export interface Pago {
  id: string;
  concepto: string;
  vencimiento: string;
  monto: number;
  estado: "pagado" | "pendiente" | "vencido";
  fechaPago?: string;
}

export interface Tramite {
  id: string;
  tipo: string;
  descripcion: string;
  fechaSolicitud: string;
  estado: "pendiente" | "en_proceso" | "aprobado" | "rechazado";
  documentoUrl?: string;
  alumnoId: string;
  alumnoNombre: string;
}

export interface Aviso {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: "info" | "warning" | "danger";
  fecha: string;
}

// ─── Usuarios mock ─────────────────────────────────────────────────────────────

export const MOCK_USERS: User[] = [
  {
    id: "u1",
    name: "Ana García López",
    email: "ana.garcia@margaritacabrera.edu.pe",
    role: "alumno",
    carrera: "Administración de Empresas",
    ciclo: "IV Ciclo",
    avatar: "AG",
  },
  {
    id: "u2",
    name: "Carlos Mendoza",
    email: "admin@margaritacabrera.edu.pe",
    role: "admin",
    carrera: "Administración",
    ciclo: "—",
    avatar: "CM",
  },
];

// Sesión simulada (cambiar role para probar)
export const CURRENT_USER: User = MOCK_USERS[0];

// ─── Pagos mock ────────────────────────────────────────────────────────────────

export const MOCK_PAGOS: Pago[] = [
  { id: "p1", concepto: "Matrícula 2024-I",    vencimiento: "2024-03-01", monto: 250,  estado: "pagado",   fechaPago: "2024-02-28" },
  { id: "p2", concepto: "Cuota 1 – Abril",     vencimiento: "2024-04-05", monto: 380,  estado: "pagado",   fechaPago: "2024-04-04" },
  { id: "p3", concepto: "Cuota 2 – Mayo",      vencimiento: "2024-05-05", monto: 380,  estado: "pagado",   fechaPago: "2024-05-03" },
  { id: "p4", concepto: "Cuota 3 – Junio",     vencimiento: "2024-06-05", monto: 380,  estado: "vencido"  },
  { id: "p5", concepto: "Cuota 4 – Julio",     vencimiento: "2024-07-05", monto: 380,  estado: "pendiente" },
  { id: "p6", concepto: "Cuota 5 – Agosto",    vencimiento: "2024-08-05", monto: 380,  estado: "pendiente" },
  { id: "p7", concepto: "Cuota 6 – Septiembre",vencimiento: "2024-09-05", monto: 380,  estado: "pendiente" },
];

// ─── Trámites mock ─────────────────────────────────────────────────────────────

export const TRAMITE_TIPOS = [
  "Constancia de Estudios",
  "Certificado de Notas",
  "Carta de Presentación",
  "Constancia de Egresado",
  "Historial Académico",
  "Certificado de Conducta",
];

export const MOCK_TRAMITES: Tramite[] = [
  {
    id: "t1",
    tipo: "Constancia de Estudios",
    descripcion: "Para trámite bancario",
    fechaSolicitud: "2024-06-10",
    estado: "aprobado",
    documentoUrl: "#",
    alumnoId: "u1",
    alumnoNombre: "Ana García López",
  },
  {
    id: "t2",
    tipo: "Certificado de Notas",
    descripcion: "Ciclos I al III",
    fechaSolicitud: "2024-06-20",
    estado: "en_proceso",
    alumnoId: "u1",
    alumnoNombre: "Ana García López",
  },
  {
    id: "t3",
    tipo: "Carta de Presentación",
    descripcion: "Para prácticas en empresa XYZ",
    fechaSolicitud: "2024-07-01",
    estado: "pendiente",
    alumnoId: "u1",
    alumnoNombre: "Ana García López",
  },
];

// ─── Avisos mock ───────────────────────────────────────────────────────────────

export const MOCK_AVISOS: Aviso[] = [
  {
    id: "a1",
    titulo: "Cuota vencida",
    descripcion: "Tienes una cuota vencida del 5 de junio. Regulariza tu pago para evitar restricciones.",
    tipo: "danger",
    fecha: "2024-07-01",
  },
  {
    id: "a2",
    titulo: "Próximo vencimiento",
    descripcion: "La Cuota 4 vence el 5 de julio. Recuerda pagar a tiempo.",
    tipo: "warning",
    fecha: "2024-07-01",
  },
  {
    id: "a3",
    titulo: "Trámite listo",
    descripcion: "Tu Constancia de Estudios ya está disponible para descarga.",
    tipo: "info",
    fecha: "2024-06-28",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function calcularDeuda(pagos: Pago[]): number {
  return pagos
    .filter((p) => p.estado !== "pagado")
    .reduce((acc, p) => acc + p.monto, 0);
}

export function formatMonto(monto: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(monto);
}

export function formatFecha(fecha: string): string {
  return new Date(fecha + "T00:00:00").toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

// ─── Roles extendidos ──────────────────────────────────────────────────────────

export type RolExtendido = "super_admin" | "staff_tramites" | "admin" | "alumno";

export interface UserExtendido extends User {
  rolExtendido: RolExtendido;
}

export const MOCK_USERS_EXT: UserExtendido[] = [
  { ...MOCK_USERS[0], rolExtendido: "alumno" },
  { ...MOCK_USERS[1], rolExtendido: "super_admin" },
  {
    id: "u3",
    name: "Lucía Torres",
    email: "staff@margaritacabrera.edu.pe",
    role: "admin",
    rolExtendido: "staff_tramites",
    carrera: "Administración",
    ciclo: "—",
    avatar: "LT",
  },
];

// ─── Trámites externos (exalumnas) ─────────────────────────────────────────────

export const TRAMITES_EXTERNOS_CATALOGO = [
  { id: "te1",  label: "1. CERTIFICADO DE ESCUELA PRIVADA (1966 A 1979)",                          nombre: "Certificado de Escuela Privada (Alumnas que estudiaron de 1966 a 1979)",                                                          costo: 50    },
  { id: "te2",  label: "2. CERTIFICADO DE CEO/CEPRO (1980 A 2013)",                                nombre: "Certificado de CEO/CEPRO (Alumnas que estudiaron de 1980 a 2013)",                                                                costo: 350   },
  { id: "te3",  label: "3. CONSTANCIA DE ESTUDIO (1980-2013)",                                     nombre: "Constancia de Estudio (Alumnas que estudiaron de 1980 a 2013)",                                                                   costo: 50    },
  { id: "te4",  label: "4. CERTIFICADO MODULAR POR MÓDULO (2013 A LA ACTUALIDAD)",                 nombre: "Certificado modular por módulo (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                                       costo: 200   },
  { id: "te5",  label: "5. CERTIFICADO OFICIAL DE NOTAS (2013 A LA ACTUALIDAD)",                   nombre: "Certificado Oficial de notas (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                                         costo: 200   },
  { id: "te6",  label: "6. CONSTANCIA DE EGRESADA (2013 A LA ACTUALIDAD)",                         nombre: "Constancia de egresada (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                                               costo: 50    },
  { id: "te7",  label: "7. CONSTANCIA DE ESTUDIO (2013 A LA ACTUALIDAD)",                          nombre: "Constancia de Estudio (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                                                costo: 50    },
  { id: "te8",  label: "8. TRÁMITE GRADO DE BACHILLER (2013 A LA ACTUALIDAD)",                     nombre: "Tramite Grado de Bachiller (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                                           costo: 1500  },
  { id: "te9",  label: "9. EXAMEN DE SUFICIENCIA PROFESIONAL / SUSTENTACIÓN (2013 A LA ACTUALIDAD)", nombre: "Examen de Suficiencia Profesional / Sustentación (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                   costo: 1000  },
  { id: "te10", label: "10. TRÁMITE DE TÍTULO A NOMBRE DE LA NACIÓN (2013 A LA ACTUALIDAD)",       nombre: "Trámite de Titulo a Nombre de la Nacion (Alumnas que estudiaron de 2013 a la actualidad) INSTITUTO",                              costo: 2000  },
  { id: "te11", label: "11. SÍLABO POR CURSO",                                                     nombre: "Sílabo por Curso",                                                                                                                costo: 350   },
] as const;

export const SILABO_CARRERAS = [] as const; // ya no se usa
export const PRECIO_SILABO   = 5;           // precio unitario interno para Nubefact (70 × 5 = 350)

export type TramiteExternoEstado = "pendiente" | "aprobado" | "observado" | "rechazado";

export interface TramiteExterno {
  id: string;
  nombres: string;
  apellidos: string;
  dni: string;
  email: string;
  celular: string;
  anioEgreso: string;
  tipoTramite: string;
  costoTramite: number;
  montoPagado: number;
  voucherUrl: string;
  dniAnversoUrl: string;
  dniReversoUrl: string;
  estado: TramiteExternoEstado;
  observacion?: string;
  fechaSolicitud: string;
}

// Sin datos de prueba — los datos reales vienen de Supabase
export const MOCK_TRAMITES_EXTERNOS: TramiteExterno[] = [];

// ─── Mock reportes ─────────────────────────────────────────────────────────────

export const MOCK_INGRESOS_MES = [
  { mes: "Ago",  total: 3200  },
  { mes: "Sep",  total: 5400  },
  { mes: "Oct",  total: 2800  },
  { mes: "Nov",  total: 7200  },
  { mes: "Dic",  total: 4100  },
  { mes: "Ene",  total: 6500  },
];

export const MOCK_TRAMITES_POR_TIPO = [
  { tipo: "Cert. Notas",    cantidad: 18 },
  { tipo: "Constancia",     cantidad: 24 },
  { tipo: "Título",         cantidad: 7  },
  { tipo: "Bachiller",      cantidad: 5  },
  { tipo: "Sustentación",   cantidad: 9  },
  { tipo: "Cert. Modular",  cantidad: 12 },
];

// ─── Mapeador oficial Nubefact ─────────────────────────────────────────────────

export interface NubefactItem {
  codigo:      number;
  descripcion: string;
  monto:       number;  // monto base (para sílabo es por unidad)
}

export const NUBEFACT_MAP: Record<string, NubefactItem> = {
  "te1":  { codigo: 31, descripcion: "CONSTANCIA DE ESTUDIO",                                    monto: 50   },
  "te2":  { codigo:  9, descripcion: "CERTIFICADO DE ESTUDIO",                                   monto: 350  },
  "te3":  { codigo: 31, descripcion: "CONSTANCIA DE ESTUDIO",                                    monto: 50   },
  "te4":  { codigo:  6, descripcion: "CERTIFICADO MODULAR POR MODULO",                           monto: 200  },
  "te5":  { codigo: 28, descripcion: "CERTIFICADO OFICIAL DE NOTAS",                             monto: 200  },
  "te6":  { codigo: 21, descripcion: "CONSTANCIA DE EGRESADO",                                   monto: 50   },
  "te7":  { codigo: 31, descripcion: "CONSTANCIA DE ESTUDIO",                                    monto: 50   },
  "te8":  { codigo:  2, descripcion: "TRÁMITE GRADO DE BACHILLER",                               monto: 1500 },
  "te9":  { codigo:  3, descripcion: "EXAMEN DE SUFICIENCIA PROFESIONAL / SUSTENTACIÓN",         monto: 1000 },
  "te10": { codigo:  8, descripcion: "TRÁMITE DE TÍTULO A NOMBRE DE LA NACIÓN",                  monto: 2000 },
  "te11": { codigo:  4, descripcion: "SILABO POR CURSO",                                         monto: 5    }, // × cantidad
};

// ─── Catálogo de Actualizaciones ──────────────────────────────────────────────

export const ACTUALIZACIONES_CATALOGO = [
  { id: "ac1", label: "IA PRÁCTICA PARA LA GESTIÓN ADMINISTRATIVA MODERNA",  costo: 100, codigoNubefact: 12 },
  { id: "ac2", label: "GESTIÓN SECRETARIAL EJECUTIVA",                        costo: 100, codigoNubefact: 12 },
] as const;
