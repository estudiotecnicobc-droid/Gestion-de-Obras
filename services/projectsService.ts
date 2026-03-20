import { supabase } from './supabaseClient';
import { BusinessConfig, Project } from '../types';

// ─── Mappers ──────────────────────────────────────────────────────────────────

function projectFromRow(row: Record<string, any>): Project {
  // Solo mapea las columnas reales de la tabla.
  // Los campos opcionales del modelo Project (pricing, workday_*, etc.)
  // quedan undefined — sus valores por defecto vienen de INITIAL_PROJECT en ERPContext.

  // BusinessConfig: se lee solo si ggd_pct tiene valor (sentinel de que los 4 fueron guardados).
  // Los 4 campos se persisten siempre en conjunto, por lo que basta con verificar uno.
  const businessConfig: BusinessConfig | undefined =
    row.ggd_pct != null
      ? {
          ggdPct:    Number(row.ggd_pct),
          ggiPct:    Number(row.ggi_pct),
          profitPct: Number(row.profit_pct),
          taxPct:    Number(row.tax_pct),
        }
      : undefined;

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    client: row.client ?? '',
    currency: row.currency ?? 'ARS',
    startDate: row.start_date ?? new Date().toISOString().split('T')[0],
    endDate: row.end_date ?? undefined,
    status: row.status ?? 'planning',
    items: [],          // budget_items vienen de tabla separada
    businessConfig,     // undefined si no fue guardada aún
    // Campos técnicos del proyecto
    address:             row.address             ?? undefined,
    companyName:         row.company_name        ?? undefined,
    surface:             row.surface != null ? Number(row.surface) : undefined,
    constructionSystem:  row.construction_system ?? undefined,
    structureType:       row.structure_type      ?? undefined,
    foundationType:      row.foundation_type     ?? undefined,
    // Motor de costos versionado (migration 010)
    costBase: row.cost_base ?? undefined,
  };
}

function normalizeDate(value?: string | null): string | null {
  if (!value || value.trim() === '') return null;
  return value;
}

function projectToRow(p: Project): Record<string, any> {
  // Solo las columnas que existen en la tabla projects de Supabase.
  // El resto del modelo Project (pricing legacy, assigned_crews, workday_*, etc.)
  // no se persiste aquí — la tabla es deliberadamente minimalista.
  return {
    id: p.id,
    organization_id: p.organizationId,
    name: p.name,
    client: p.client ?? null,
    currency: p.currency ?? 'ARS',
    start_date: normalizeDate(p.startDate),
    end_date: normalizeDate(p.endDate),
    status: p.status ?? 'draft',
    // BusinessConfig K — null si el proyecto se crea sin config explícita
    ggd_pct:    p.businessConfig?.ggdPct    ?? null,
    ggi_pct:    p.businessConfig?.ggiPct    ?? null,
    profit_pct: p.businessConfig?.profitPct ?? null,
    tax_pct:    p.businessConfig?.taxPct    ?? null,
    // Campos técnicos
    address:             p.address             ?? null,
    company_name:        p.companyName         ?? null,
    surface:             p.surface             ?? null,
    construction_system: p.constructionSystem  ?? null,
    structure_type:      p.structureType       ?? null,
    foundation_type:     p.foundationType      ?? null,
    // Motor de costos versionado (migration 010)
    cost_base:           p.costBase            ?? null,
  };
}

function buildUpdateRow(updates: Partial<Project>): Record<string, any> {
  // Mismo criterio que projectToRow: solo columnas reales de la tabla.
  const row: Record<string, any> = {};
  if (updates.name !== undefined)      row.name = updates.name;
  if (updates.client !== undefined)    row.client = updates.client;
  if (updates.currency !== undefined)  row.currency = updates.currency;
  if (updates.startDate !== undefined) row.start_date = normalizeDate(updates.startDate);
  if (updates.endDate !== undefined)   row.end_date   = normalizeDate(updates.endDate);
  if (updates.status !== undefined)    row.status = updates.status;
  // BusinessConfig K: los 4 campos se escriben juntos o ninguno.
  // null explícito = borrar config guardada (el store usará DEFAULT_BUSINESS_CONFIG).
  if (updates.businessConfig !== undefined) {
    row.ggd_pct    = updates.businessConfig?.ggdPct    ?? null;
    row.ggi_pct    = updates.businessConfig?.ggiPct    ?? null;
    row.profit_pct = updates.businessConfig?.profitPct ?? null;
    row.tax_pct    = updates.businessConfig?.taxPct    ?? null;
  }
  if (updates.address !== undefined)             row.address             = updates.address ?? null;
  if (updates.companyName !== undefined)         row.company_name        = updates.companyName ?? null;
  if (updates.surface !== undefined)             row.surface             = updates.surface ?? null;
  if (updates.constructionSystem !== undefined)  row.construction_system = updates.constructionSystem ?? null;
  if (updates.structureType !== undefined)       row.structure_type      = updates.structureType ?? null;
  if (updates.foundationType !== undefined)      row.foundation_type     = updates.foundationType ?? null;
  if (updates.costBase !== undefined)            row.cost_base           = updates.costBase ?? null;
  return row;
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const projectsService = {

  async list(organizationId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) { console.error('[projectsService.list]', error.message); return []; }
    return (data ?? []).map(projectFromRow);
  },

  async create(project: Project): Promise<void> {
    const row = projectToRow(project);
    const { error } = await supabase.from('projects').insert(row);
    if (error) throw new Error(`[projectsService.create] ${error.message}`);
  },

  async update(id: string, updates: Partial<Project>): Promise<void> {
    const row = buildUpdateRow(updates);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('projects').update(row).eq('id', id);
    if (error) throw new Error(`[projectsService.update] ${error.message}`);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(`[projectsService.remove] ${error.message}`);
  },
};
