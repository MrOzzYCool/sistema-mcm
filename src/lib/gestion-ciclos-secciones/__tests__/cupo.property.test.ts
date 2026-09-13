// Feature: gestion-ciclos-secciones
// Property-based tests (fast-check) del modelo de referencia puro de cupo y
// ciclo de vida de secciones (`src/lib/gestion-ciclos-secciones/cupo.ts`).
//
// La aplicación real vive en la RPC de Postgres `enroll_into_opening`, que no
// puede ejecutarse en unit tests. Estas propiedades verifican la conducta
// prevista de esa lógica sobre un modelo puro y determinístico.
//
// Tareas: 4.2 (Property 1), 4.3 (Property 2), 4.4 (Property 3), 4.5 (Property 4)

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  intentarMatricula,
  esDuplicado,
  agregarMatricula,
  type SeccionEstado,
  type MatriculaTupla,
} from "../cupo";

const RUNS = 200;

describe("cupo.property — modelo de referencia de la RPC enroll_into_opening", () => {
  // Feature: gestion-ciclos-secciones, Property 1
  // Valida: Requisitos 2.4, 3.2, 3.3, 3.7, 8.4
  it("Property 1: el tope nunca se excede (task 4.2)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // tope T
        fc.integer({ min: 0, max: 80 }), // N intentos
        (tope, intentos) => {
          let estado: SeccionEstado = { tope, vinculadas: 0, status: "activo" };
          let aceptadas = 0;

          for (let i = 0; i < intentos; i++) {
            const outcome = intentarMatricula(estado);
            if (outcome.ok) {
              aceptadas++;
              estado = outcome.nuevoEstado;
            }
            // El invariante debe mantenerse tras CADA intento.
            expect(estado.vinculadas).toBeLessThanOrEqual(tope);
          }

          // Se aceptan exactamente min(N, T) matrículas.
          expect(aceptadas).toBe(Math.min(intentos, tope));
          // El conteo final refleja las aceptadas y nunca supera el tope.
          expect(estado.vinculadas).toBe(Math.min(intentos, tope));
          expect(estado.vinculadas).toBeLessThanOrEqual(tope);
        }
      ),
      { numRuns: RUNS }
    );
  });

  // Feature: gestion-ciclos-secciones, Property 2
  // Valida: Requisitos 3.6
  it("Property 2: sin matrícula activa duplicada (task 4.3)", () => {
    const tuplaArb: fc.Arbitrary<MatriculaTupla> = fc.record({
      alumno_id: fc.constantFrom("a1", "a2", "a3", "a4"),
      carrera_id: fc.constantFrom("c1", "c2"),
      ciclo: fc.integer({ min: 1, max: 6 }),
    });

    fc.assert(
      fc.property(
        fc.array(tuplaArb, { minLength: 0, maxLength: 30 }),
        tuplaArb,
        (existentesRaw, intento) => {
          // Construir un conjunto activo SIN duplicados a partir de la lista cruda.
          let existentes: MatriculaTupla[] = [];
          for (const t of existentesRaw) {
            existentes = agregarMatricula(existentes, t);
          }
          const antes = existentes.length;
          const yaExiste = esDuplicado(existentes, intento);

          const despues = agregarMatricula(existentes, intento);

          if (yaExiste) {
            // Un intento duplicado NUNCA hace crecer el conjunto activo.
            expect(despues.length).toBe(antes);
          } else {
            // Un intento nuevo agrega exactamente una tupla...
            expect(despues.length).toBe(antes + 1);
            // ...y aplicarlo de nuevo ya es duplicado (idempotencia del rechazo).
            const tercero = agregarMatricula(despues, intento);
            expect(tercero.length).toBe(despues.length);
          }

          // El conjunto resultante nunca contiene tuplas repetidas.
          const claves = despues.map(
            (t) => `${t.alumno_id}::${t.carrera_id}::${t.ciclo}`
          );
          expect(new Set(claves).size).toBe(claves.length);
        }
      ),
      { numRuns: RUNS }
    );
  });

  // Feature: gestion-ciclos-secciones, Property 3
  // Valida: Requisitos 3.3, 3.5, 5.2, 5.5
  it("Property 3: rechazo de matrícula en secciones no disponibles (task 4.4)", () => {
    const estadoNoDisponibleArb: fc.Arbitrary<SeccionEstado> = fc.oneof(
      // Estado que no admite matrículas, con cupo arbitrario.
      fc.record({
        tope: fc.integer({ min: 1, max: 50 }),
        vinculadas: fc.integer({ min: 0, max: 50 }),
        status: fc.constantFrom<SeccionEstado["status"]>(
          "llena",
          "concluido",
          "suspendido"
        ),
      }),
      // Estado activo pero sin cupos (vinculadas >= tope).
      fc
        .integer({ min: 1, max: 50 })
        .chain((tope) =>
          fc.record({
            tope: fc.constant(tope),
            vinculadas: fc.integer({ min: tope, max: tope + 30 }),
            status: fc.constant<SeccionEstado["status"]>("activo"),
          })
        )
    );

    fc.assert(
      fc.property(estadoNoDisponibleArb, (estado) => {
        const outcome = intentarMatricula(estado);
        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
          // El error corresponde al motivo del rechazo.
          if (estado.status !== "activo") {
            expect(outcome.error).toBe("SECCION_NO_ADMITE_MATRICULAS");
          } else {
            expect(outcome.error).toBe("SECCION_LLENA");
          }
        }
      }),
      { numRuns: RUNS }
    );
  });

  // Feature: gestion-ciclos-secciones, Property 4
  // Valida: Requisitos 5.1
  it("Property 4: transición a 'llena' al alcanzar el tope (task 4.5)", () => {
    // Genera una sección 'activo' con cupo disponible (vinculadas < tope).
    const estadoActivoConCupoArb: fc.Arbitrary<SeccionEstado> = fc
      .integer({ min: 1, max: 50 })
      .chain((tope) =>
        fc.record({
          tope: fc.constant(tope),
          vinculadas: fc.integer({ min: 0, max: tope - 1 }),
          status: fc.constant<SeccionEstado["status"]>("activo"),
        })
      );

    fc.assert(
      fc.property(estadoActivoConCupoArb, (estado) => {
        const outcome = intentarMatricula(estado);
        // Siempre hay cupo, así que la matrícula se acepta.
        expect(outcome.ok).toBe(true);
        if (outcome.ok) {
          const { nuevoEstado } = outcome;
          expect(nuevoEstado.vinculadas).toBe(estado.vinculadas + 1);

          if (estado.vinculadas === estado.tope - 1) {
            // Al alcanzar el tope, la sección pasa a 'llena'.
            expect(nuevoEstado.status).toBe("llena");
            expect(nuevoEstado.vinculadas).toBe(estado.tope);
          } else {
            // Aún con cupo, la sección permanece 'activo'.
            expect(nuevoEstado.status).toBe("activo");
            expect(nuevoEstado.vinculadas).toBeLessThan(estado.tope);
          }
        }
      }),
      { numRuns: RUNS }
    );
  });
});
