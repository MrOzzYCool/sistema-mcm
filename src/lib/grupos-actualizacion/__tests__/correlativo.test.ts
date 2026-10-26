import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  calcularSiguienteNumeroGrupo,
  DEFAULT_NUMERO_INICIO_GRUPO,
} from '../logic'
import { ACTUALIZACIONES_CATALOGO } from '../../mock-data'

describe('numero-correlativo-grupos', () => {
  // ─── Tarea 3.2 — Property 1 ────────────────────────────────────────────────
  // Feature: numero-correlativo-grupos, Property 1: Monotonía estricta del correlativo
  // Validates: Requirements 2.1, 3.1
  it('Property 1: monotonía estricta — resultado = max + 1 y mayor que todos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 50 }),
        (numeroInicio, arr) => {
          const resultado = calcularSiguienteNumeroGrupo(numeroInicio, arr)
          expect(resultado).toBe(Math.max(...arr) + 1)
          for (const n of arr) {
            expect(resultado).toBeGreaterThan(n)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // ─── Tarea 3.3 — Property 2 ────────────────────────────────────────────────
  // Feature: numero-correlativo-grupos, Property 2: Respeto del número de inicio sin grupos previos
  // Validates: Requirements 2.2, 1.3
  it('Property 2: respeto del número de inicio — lista vacía devuelve numeroInicio', () => {
    fc.assert(
      fc.property(fc.integer(), (numeroInicio) => {
        expect(calcularSiguienteNumeroGrupo(numeroInicio, [])).toBe(numeroInicio)
      }),
      { numRuns: 100 }
    )
  })

  it('Property 2: respeto del número de inicio — lista solo de null/undefined devuelve numeroInicio', () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.constantFrom<null | undefined>(null, undefined), { minLength: 1, maxLength: 50 }),
        (numeroInicio, arr) => {
          expect(calcularSiguienteNumeroGrupo(numeroInicio, arr)).toBe(numeroInicio)
        }
      ),
      { numRuns: 100 }
    )
  })

  // ─── Tarea 3.4 — Pruebas de ejemplo (sin fast-check) ───────────────────────
  it('catálogo: ac1.numeroInicioGrupo === 10', () => {
    expect(
      ACTUALIZACIONES_CATALOGO.find((p) => p.id === 'ac1')?.numeroInicioGrupo
    ).toBe(10)
  })

  it('catálogo: ac2.numeroInicioGrupo === 30', () => {
    expect(
      ACTUALIZACIONES_CATALOGO.find((p) => p.id === 'ac2')?.numeroInicioGrupo
    ).toBe(30)
  })

  it('default: lista vacía con DEFAULT_NUMERO_INICIO_GRUPO devuelve 1', () => {
    expect(calcularSiguienteNumeroGrupo(DEFAULT_NUMERO_INICIO_GRUPO, [])).toBe(1)
  })

  it('mezcla activos/cerrados: usa el máximo global sin importar orden/estado', () => {
    expect(calcularSiguienteNumeroGrupo(30, [30, 31, 29])).toBe(32)
  })

  it('ignora null/undefined al calcular el máximo', () => {
    expect(calcularSiguienteNumeroGrupo(10, [10, null, 11, undefined])).toBe(12)
  })
})
