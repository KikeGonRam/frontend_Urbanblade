export interface AuthUser {
  id: string | number;
  name: string;
  email: string;
  avatar_url: string | null;
  roles: string[];
  profile_complete: boolean;
  profile_missing: string[];
  client_id: string | number | null;
  barber_id: string | number | null;
}

interface LoginResponse {
  message: string;
  token_type: string;
  token: string;
  user: AuthUser;
}

interface MeResponse {
  user: AuthUser;
}

/**
 * Sesión vía el token Bearer propio de barber (tabla mobile_api_tokens,
 * endpoint POST /auth/login en routes/api.php — NO Sanctum). El token vive
 * en una cookie legible por cliente (no httpOnly: no hay backend-for-frontend
 * que la esconda) y se manda como Authorization: Bearer <token> en cada
 * llamada — ver useApi().
 */
export function useAuth() {
  const token = useCookie<string | null>("ub_token", {
    default: () => null,
    maxAge: 60 * 60 * 24 * 180, // 6 meses — igual al refresh-token del backend
    sameSite: "lax",
  });
  const user = useState<AuthUser | null>("auth_user", () => null);
  const config = useRuntimeConfig();

  const isAuthenticated = computed(() => !!token.value);

  function hasRole(role: string): boolean {
    return user.value?.roles.includes(role) ?? false;
  }

  async function login(email: string, password: string) {
    const data = await $fetch<LoginResponse>("/auth/login", {
      baseURL: config.public.apiBase,
      method: "POST",
      body: { email, password, device_name: "Nuxt Web" },
    });

    token.value = data.token;
    user.value = data.user;

    return data.user;
  }

  /**
   * Registro (AuthController::register()): igual que login(), el backend ya
   * devuelve token + user en la misma respuesta (201) -- auto-login, no hace
   * falta un paso de login aparte después de registrarse.
   */
  async function register(
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string,
  ) {
    const data = await $fetch<LoginResponse>("/auth/register", {
      baseURL: config.public.apiBase,
      method: "POST",
      body: {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        device_name: "Nuxt Web",
      },
    });

    token.value = data.token;
    user.value = data.user;

    return data.user;
  }

  /**
   * AuthController::forgotPassword() -- no autentica, solo dispara el correo
   * de recuperación (o falla en silencio si el correo no existe, mismo
   * criterio de no revelar qué correos están registrados que ya sigue login()).
   */
  async function forgotPassword(email: string) {
    return await $fetch<{ message: string }>("/auth/forgot-password", {
      baseURL: config.public.apiBase,
      method: "POST",
      body: { email },
    });
  }

  /**
   * AuthController::resetPassword() -- token y email vienen del link del
   * correo (ver ResetPassword::createUrlUsing() en barber, apunta a
   * /reset-password?token=...&email=...). No autentica: el usuario debe
   * iniciar sesión de nuevo con la contraseña nueva.
   */
  async function resetPassword(
    resetToken: string,
    email: string,
    password: string,
    passwordConfirmation: string,
  ) {
    return await $fetch<{ message: string }>("/auth/reset-password", {
      baseURL: config.public.apiBase,
      method: "POST",
      body: {
        token: resetToken,
        email,
        password,
        password_confirmation: passwordConfirmation,
      },
    });
  }

  async function fetchMe() {
    if (!token.value) {
      user.value = null;

      return null;
    }

    try {
      const data = await $fetch<MeResponse>("/auth/me", {
        baseURL: config.public.apiBase,
        headers: { Authorization: `Bearer ${token.value}` },
      });
      user.value = data.user;

      return data.user;
    } catch {
      // Token inválido/expirado — limpiar sesión local.
      token.value = null;
      user.value = null;

      return null;
    }
  }

  async function logout() {
    if (token.value) {
      try {
        await $fetch("/auth/logout", {
          baseURL: config.public.apiBase,
          method: "POST",
          headers: { Authorization: `Bearer ${token.value}` },
        });
      } catch {
        // Revocar localmente aunque la llamada falle (p.ej. token ya vencido).
      }
    }

    token.value = null;
    user.value = null;
  }

  return {
    token,
    user,
    isAuthenticated,
    hasRole,
    login,
    register,
    forgotPassword,
    resetPassword,
    fetchMe,
    logout,
  };
}
