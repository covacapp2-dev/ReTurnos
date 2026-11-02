-- ============================================
-- ReTurnos - Migración: deporte en las canchas
-- Fecha: 2026-11-03
-- Ejecutar en: Supabase SQL Editor
--
-- Agrega la columna "sport" a la tabla resources
-- para identificar cada cancha con su deporte
-- (fútbol, pádel, tenis, etc.).
-- ============================================

ALTER TABLE resources ADD COLUMN IF NOT EXISTS sport text;

CREATE INDEX IF NOT EXISTS idx_resources_sport
  ON resources(business_id, sport);
