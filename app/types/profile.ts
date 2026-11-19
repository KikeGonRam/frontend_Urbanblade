/** Tipos de la página «Mi perfil» y sus secciones. */
import type { AuthUser } from "~/composables/useAuth";

export interface ProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    roles: string[];
    created_at?: string;
    profile_complete?: boolean;
    profile_missing?: string[];
    client: {
      telefono: string | null;
      fecha_nacimiento: string | null;
      sexo: string | null;
    } | null;
  };
}

export interface BarberProfileResponse {
  name: string;
  email: string;
  especialidades: string;
  descripcion: string;
  foto_url: string | null;
  calificacion_promedio: number | null;
  total_resenas: number;
  years_experience: number;
  portfolio_total: number;
}

export interface UpdateResponse {
  message: string;
  user: AuthUser | null;
}

/** Errores de validación del servidor (422) por campo. */
export type FieldErrors = Record<string, string[]>;

export type ProfileSection = "public" | "personal" | "security" | "danger";

/** Forma del error de `$fetch` que usan los formularios del perfil. */
export interface ApiErrorData {
  message?: string;
  errors?: FieldErrors;
}
