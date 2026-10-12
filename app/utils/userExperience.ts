/** Misma prioridad que barber/App\Support\UserExperience y Android/UserExperience. */
export const EXPERIENCE_ROLES = ['administrador', 'recepcionista', 'barbero', 'ingeniero', 'cliente'] as const
export type ExperienceRole = typeof EXPERIENCE_ROLES[number] | 'guest'

export function primaryRole(roles: readonly string[] = []): ExperienceRole {
  return EXPERIENCE_ROLES.find(role => roles.includes(role)) ?? 'guest'
}

export function isClientExperience(roles: readonly string[] = []): boolean {
  return primaryRole(roles) === 'cliente'
}
