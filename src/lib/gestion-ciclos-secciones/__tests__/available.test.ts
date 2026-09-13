// Feature: gestion-ciclos-secciones
// Tests unitarios del cálculo PURO de cupos disponibles
// (`calcularCupos` en `src/lib/gestion-ciclos-secciones/cupo.ts`).
//
// Reflejan el `cupos_disponibles = tope - vinculadas` que expone
// `GET /api/admin/cycle-openings/available` sin tocar Supabase.
//
// Tarea: 3.2 — Valida: Requisitos 3.1, 2.4

import { describe, it, expect } from "vitest";
import { calcularCupos } from "../cupo";

describe("calcularCupos", () => {
  it("devuelve tope - vinculadas para varios valores", () => {
    expect(calcularCupos(20, 0)).toBe(20);
    expect(calcularCupos(20, 5)).toBe(15);
    expect(calcularCupos(20, 19)).toBe(1);
    expect(calcularCupos(10, 3)).toBe(7);
    expect(calcularCupos(1, 0)).toBe(1);
  });

  it("devuelve 0 cuando la sección está exactamente llena", () => {
    expect(calcularCupos(20, 20)).toBe(0);
    expect(calcularCupos(1, 1)).toBe(0);
  });

  it("devuelve un valor negativo en sobrecupo (vinculadas > tope)", () => {
    // p. ej. tras reducir el tope de una sección ya poblada.
    expect(calcularCupos(20, 25)).toBe(-5);
    expect(calcularCupos(10, 11)).toBe(-1);
  });
});
