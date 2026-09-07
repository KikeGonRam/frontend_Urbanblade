import type { Page } from "@playwright/test";

/**
 * Intercepta la API de barber en el navegador. Estas pruebas verifican el
 * comportamiento del FRONTEND (guards, redirecciones, gate de perfil
 * incompleto, manejo de errores); el backend ya tiene su propia suite de
 * 355 pruebas en ../barber, así que duplicarlo aquí solo agregaría
 * fragilidad y dependencia de Laravel+Mongo+Redis levantados en CI.
 *
 * Ojo: page.route() solo intercepta peticiones del NAVEGADOR. Las llamadas
 * que Nuxt hace durante SSR salen del proceso de Node y no pasan por aquí —
 * por eso las pruebas entran por una página sin datos (/login) y navegan del
 * lado del cliente, en vez de hacer goto() directo a una página protegida
 * que resolvería sus datos en el servidor.
 */

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  roles: string[];
  profile_complete: boolean;
  profile_missing: string[];
  client_id: string | null;
  barber_id: string | null;
}

export function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "u-1",
    name: "Cliente Prueba",
    email: "cliente@test.local",
    avatar_url: null,
    roles: ["cliente"],
    profile_complete: true,
    profile_missing: [],
    client_id: "c-1",
    barber_id: null,
    ...overrides,
  };
}

export interface MockApiOptions {
  /** Usuario devuelto por /auth/login, /auth/register y /auth/me. */
  user?: MockUser;
  /** Status de /auth/login (422 = credenciales inválidas, 429 = rate limit). */
  loginStatus?: number;
  /** Status de /auth/register. */
  registerStatus?: number;
  /** Cuerpo extra para respuestas de error (p. ej. errores de validación). */
  errorBody?: Record<string, unknown>;
}

export async function mockApi(page: Page, options: MockApiOptions = {}) {
  const {
    user = makeUser(),
    loginStatus = 200,
    registerStatus = 201,
    errorBody = { message: "Error" },
  } = options;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(body),
      });

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    }

    if (path === "/auth/login" && method === "POST") {
      return loginStatus === 200
        ? json({
            message: "ok",
            token_type: "Bearer",
            token: "test-token",
            user,
          })
        : json(errorBody, loginStatus);
    }

    if (path === "/auth/register" && method === "POST") {
      return registerStatus === 201
        ? json(
            { message: "ok", token_type: "Bearer", token: "test-token", user },
            201,
          )
        : json(errorBody, registerStatus);
    }

    if (path === "/auth/me") {
      return json({ user });
    }

    if (path === "/auth/logout") {
      return json({ message: "ok" });
    }

    if (path === "/dashboard") {
      return json({ role: user.roles[0] ?? "cliente", data: {} });
    }

    if (path === "/profile") {
      return json({
        user: {
          name: user.name,
          email: user.email,
          client: { telefono: null, fecha_nacimiento: null },
        },
      });
    }

    // Cualquier otro endpoint: una colección vacía es suficiente para que la
    // página renderice su estado vacío sin romperse.
    return json({ data: [] });
  });
}
