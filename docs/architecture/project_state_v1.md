# Estado del Proyecto v1 — Gestion de Obras

## Stack
- React
- TypeScript
- Vite
- Supabase
- Multiempresa por `organization_id`

## Arquitectura general
La app está migrando desde un modelo híbrido/localStorage a Supabase.
El objetivo es que el núcleo operativo quede 100% persistido y compartido por empresa.

## Núcleo ya migrado o en proceso
- auth
- organizations
- profiles
- organization_members
- projects
- tasks
- budget_items
- task_yields
- task_labor_yields
- task_tool_yields
- materials
- tools
- labor_categories
- master_tasks / APU
- budget_templates
- invitations
- users & permissions (fase 1)

## Módulos todavía sensibles / a revisar
- crews y task_crew_yields
- planning
- dashboard
- management panel
- snapshots
- receptions
- subcontractors
- contracts
- certifications
- documents
- quality
- rubros
- calendar presets

## Reglas de producto

### Base de Datos
Debe quedar simplificada en:
- Recursos
- Mano de Obra
- Analisis de Precios (APU)
- Plantillas
- Sistema

### Proyecto
Debe consumir:
- recursos de empresa
- APU de empresa
- presupuesto propio del proyecto
- planificación propia del proyecto

## Riesgos actuales
- RLS mal configurada en módulos nuevos
- race conditions en auth/signup
- invitaciones inseguras o frágiles
- mezcla de orgs en pruebas manuales
- UI mostrando menos permisos de los reales si `memberships` falla

## Convención de trabajo
Cada cambio importante debe tener:
- spec en `/docs/specs/`
- migración en `/supabase/migrations/`
- prompt asociado en `/prompts/`
- checklist QA en `/docs/qa/`

## Próxima prioridad
1. estabilizar usuarios/invitaciones/permisos
2. validar colaboración real misma empresa
3. auditar Planning / Dashboard / ManagementPanel
4. incorporar lógica de planillas de cómputo al módulo de presupuesto
