import { createServer } from "node:http";

/**
 * Servidor mínimo que finge la API de barber para las pruebas E2E.
 *
 * Existe por una razón concreta: page.route() de Playwright solo intercepta
 * peticiones del NAVEGADOR. Nuxt resuelve useAsyncData() del lado del
 * servidor en una carga completa (page.goto), y esas llamadas salen del
 * proceso de Nitro — sin este servidor, cualquier página con datos renderiza
 * vacía en SSR (selects sin opciones, listas sin filas) y las pruebas fallan
 * por un motivo que no tiene nada que ver con lo que quieren verificar.
 *
 * División de responsabilidades: aquí viven las LECTURAS estables
 * (catálogos, listados); el comportamiento que cambia por prueba (un POST
 * que responde 201 o 422) se sigue haciendo con page.route(), que tiene
 * prioridad sobre este servidor para las peticiones del navegador.
 */

// 8099, no 8000: en local el 8000 lo ocupa el backend real de barber
// corriendo en Docker, y arrancar aquí chocaría con él (o peor, las pruebas
// pegarían contra la base de datos real en vez de contra este mock).
const PORT = Number(process.env.MOCK_API_PORT ?? 8099);

const user = {
  id: "u-1",
  name: "Cliente Prueba",
  email: "cliente@test.local",
  avatar_url: null,
  roles: ["cliente"],
  profile_complete: true,
  profile_missing: [],
  client_id: "c-1",
  barber_id: null,
};

const barbers = [
  { id: "b-1", slug: "nava-panther", user: { name: "Nava Panther" } },
];
const services = [
  { id: "s-1", nombre: "Corte clásico", precio: 150, duracion_min: 30 },
];

const routes = {
  "/auth/me": { user },
  "/barbers": { data: barbers },
  "/services": { data: services },
  "/dashboard": { role: "cliente", data: {} },
  "/appointments": {
    data: [],
    stats: { total: 0, proximas: 0, completadas: 0, canceladas: 0 },
    next: null,
    cancellation_policy_hours: 24,
  },
  // AvailabilityController::slots() ya devuelve solo los huecos libres.
  "/availability/slots": {
    slots: [
      { time: "10:00", label: "10:00 AM", end_time: "10:30", end_label: "10:30 AM" },
      { time: "11:00", label: "11:00 AM", end_time: "11:30", end_label: "11:30 AM" },
    ],
  },
  "/profile": {
    user: {
      name: user.name,
      email: user.email,
      client: { telefono: null, fecha_nacimiento: null },
    },
  },
};

createServer((req, res) => {
  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname.replace(
    "/api/v1",
    "",
  );

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);

    return res.end();
  }

  // Ficha de un barbero: /barbers/<slug>
  if (path.startsWith("/barbers/")) {
    res.writeHead(200);

    return res.end(
      JSON.stringify({
        barber: {
          ...barbers[0],
          descripcion: null,
          especialidades: null,
          foto: null,
          user: { id: "bu-1", name: "Nava Panther" },
        },
        works: [],
        reviews: [],
        avg_rating: null,
        total_reviews: 0,
        citas_completadas: 0,
        can_review: false,
        already_reviewed: false,
      }),
    );
  }

  res.writeHead(200);
  res.end(JSON.stringify(routes[path] ?? { data: [] }));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-api] escuchando en http://127.0.0.1:${PORT}`);
});
