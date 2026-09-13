// Feature: gestion-ciclos-secciones
// Tests unitarios de la validación PURA de apertura de sección
// (`src/lib/gestion-ciclos-secciones/apertura-validation.ts`).
//
// Reflejan las reglas del `POST /api/admin/cycle-openings` sin tocar Supabase.
//
// Tarea: 2.2 — Valida: Requisitos 1.1, 1.2, 1.3

import { describe, it, expect } from "vitest";
import { validarApertura, type AperturaInput } from "../apertura-validation";

/** Body base válido reutilizable en cada caso. */
const validBody: AperturaInput = {
  carrera_id: "c1",
  cycle_number: 1,
  start_date: "2025-03-03",
  tope: 20,
};

describe("validarApertura", () => {
  it("acepta un body válido devolviendo null", () => {
    expect(validarApertura(validBody)).toBeNull();
  });

  it("acepta el tope mínimo permitido (1)", () => {
    expect(validarApertura({ ...validBody, tope: 1 })).toBeNull();
  });

  describe("carrera_id", () => {
    it("rechaza carrera_id ausente (undefined)", () => {
      const { carrera_id: _omit, ...rest } = validBody;
      void _omit;
      expect(validarApertura(rest)).toEqual({
        field: "carrera_id",
        message: "La carrera es obligatoria",
      });
    });

    it("rechaza carrera_id vacío", () => {
      expect(validarApertura({ ...validBody, carrera_id: "" })).toEqual({
        field: "carrera_id",
        message: "La carrera es obligatoria",
      });
    });
  });

  describe("cycle_number / start_date", () => {
    it("rechaza cycle_number ausente", () => {
      const { cycle_number: _omit, ...rest } = validBody;
      void _omit;
      expect(validarApertura(rest)).toEqual({
        field: "cycle_number|start_date",
        message: "cycle_number y start_date son requeridos",
      });
    });

    it("rechaza start_date ausente", () => {
      const { start_date: _omit, ...rest } = validBody;
      void _omit;
      expect(validarApertura(rest)).toEqual({
        field: "cycle_number|start_date",
        message: "cycle_number y start_date son requeridos",
      });
    });

    it("rechaza cycle_number no entero positivo", () => {
      expect(validarApertura({ ...validBody, cycle_number: 1.5 })).toEqual({
        field: "cycle_number",
        message: "cycle_number debe ser un entero positivo",
      });
    });
  });

  describe("tope", () => {
    it("rechaza tope = 0", () => {
      expect(validarApertura({ ...validBody, tope: 0 })).toEqual({
        field: "tope",
        message: "El tope debe ser un entero mayor o igual a 1",
      });
    });

    it("rechaza tope negativo", () => {
      expect(validarApertura({ ...validBody, tope: -5 })).toEqual({
        field: "tope",
        message: "El tope debe ser un entero mayor o igual a 1",
      });
    });

    it("rechaza tope no entero", () => {
      expect(validarApertura({ ...validBody, tope: 3.7 })).toEqual({
        field: "tope",
        message: "El tope debe ser un entero mayor o igual a 1",
      });
    });

    it("rechaza tope ausente", () => {
      const { tope: _omit, ...rest } = validBody;
      void _omit;
      expect(validarApertura(rest)).toEqual({
        field: "tope",
        message: "El tope debe ser un entero mayor o igual a 1",
      });
    });
  });
});
