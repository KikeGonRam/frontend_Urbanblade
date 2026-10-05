/**
 * Tipos de la API derivados del OpenAPI de barber (T094 / HU-27, ver
 * .claude/skills/api-contract-plan/SKILL.md).
 *
 * `api.d.ts` se genera con `npm run contract:types` desde contract/openapi.yaml
 * y NO se edita a mano. Aquí solo se nombra lo que usa la app y se corrige lo
 * que un ejemplo de respuesta no puede expresar: el schema se infiere de un
 * ejemplo con valores, y un ejemplo no dice qué campos pueden ser `null`.
 * `Nullable<T, K>` exige que K sean claves reales de T: si el backend renombra
 * un campo, esto deja de compilar en vez de seguir compilando contra un tipo viejo.
 */
import type { paths } from "./api";

/** Cuerpo JSON de la respuesta `S` del método `M` en la ruta `P`. */
export type ApiResponse<
  P extends keyof paths,
  M extends keyof paths[P],
  S extends number = 200,
> =
  NonNullable<paths[P][M]> extends { responses: infer R }
    ? S extends keyof R
      ? R[S] extends { content: { "application/json": infer B } }
        ? B
        : never
      : never
    : never;

/** Marca como `| null` las claves K de T (el spec generado no lo sabe). */
export type Nullable<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | null;
};

// --- Auth ---------------------------------------------------------------

export type ApiLoginResponse = ApiResponse<"/api/v1/auth/login", "post">;
export type ApiMeResponse = ApiResponse<"/api/v1/auth/me", "get">;

/**
 * `GET /auth/me` es un superconjunto de lo que devuelve el login: solo ahí
 * viene `client.descuento_activo_pct` (opcional), así que el tipo de /me sirve
 * para ambos cuando se guarda el usuario en el estado.
 */
type ApiMeUser = ApiMeResponse["user"];
type ApiClientProfile = NonNullable<ApiMeUser["client"]>;

export type ApiUser = Omit<
  Nullable<ApiMeUser, "avatar_url" | "client_id" | "barber_id">,
  "client"
> & {
  /** `null` para usuarios sin perfil de cliente (administración, barberos). */
  client:
    | (Omit<
        Nullable<ApiClientProfile, "telefono" | "fecha_nacimiento" | "sexo">,
        "descuento_activo_pct"
      > & {
        /** Solo viene en `GET /auth/me`; el login no lo calcula. */
        descuento_activo_pct?: number;
      })
    | null;
};

// --- Citas --------------------------------------------------------------

type ApiAppointmentsIndex = ApiResponse<"/api/v1/appointments", "get">;
type ApiAppointmentRaw = ApiAppointmentsIndex["data"][number];

/** Cita tal como la serializa AppointmentResource (staff, barbero y cliente). */
export type ApiAppointment = Omit<
  Nullable<
    ApiAppointmentRaw,
    | "notas"
    | "precio_cobrado"
    | "propina_sugerida"
    | "deposito_monto"
    | "deposito_estado"
  >,
  "client" | "barber" | "service" | "has_payment" | "is_chargeable"
> & {
  // Solo vienen en el listado (withCount('payments')); `next` y la respuesta del POST no los traen.
  has_payment?: boolean;
  is_chargeable?: boolean;
  client: {
    id: string | null;
    user: { name: string | null; avatar_url: string | null };
  };
  barber: {
    id: string | null;
    slug: string | null;
    user: { name: string | null };
    foto_url: string | null;
  };
  service: {
    id: string | null;
    nombre: string | null;
    precio: number | null;
    duracion_min: number | null;
  };
};

/** `GET /appointments` para el rol cliente: agrega estadísticas y la próxima cita. */
export type ApiClientAppointmentsResponse = {
  data: ApiAppointment[];
  stats: Extract<
    ApiAppointmentsIndex,
    { stats: unknown }
  >["stats"];
  next: ApiAppointment | null;
  cancellation_policy_hours: number;
};
