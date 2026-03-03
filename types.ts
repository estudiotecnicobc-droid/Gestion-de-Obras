
// Definición de las entidades base del sistema

export type Role = 'admin' | 'project_manager' | 'worker' | 'client';

// NEW: Cost Families based on User Request
export type CostFamily = 'MATERIAL' | 'MANO DE OBRA' | 'EQUIPOS' | 'SUBCONTRATO' | 'COSTO INDIRECTO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string; // Tenant ID
}

export enum LinkType {
  FS = 'FC', // Fin-Comienzo
  SS = 'CC', // Comienzo-Comienzo
  FF = 'FF', // Fin-Fin
  SF = 'CF'  // Comienzo-Fin
}

export interface Dependency {
  predecessorId: string; // ID de otro BudgetItem
  type: LinkType;
  lag: number; // Días de demora (positivo o negativo)
}

export interface Material {
  id: string;
  organizationId: string; // Multitenant
  name: string;
  unit: string;
  cost: number;
  category?: string; 
  minStock?: number; 
  provider?: string;
  family?: CostFamily; // Optional override, defaults to MATERIAL
  
  // NEW: Extended Fields
  description?: string;
  commercialFormat?: string; // e.g. "Bolsa 50kg", "Barra 12m"
  wastePercent?: number; // Standard waste percentage
}

export interface Tool {
  id: string;
  organizationId: string; // Multitenant
  name: string;
  category: string; 
  costPerHour: number; 
  family?: CostFamily; // Optional override, defaults to EQUIPOS
}

export interface LaborCategory {
  id: string;
  organizationId: string; // Multitenant
  role: string; // Nombre del rol (ej: Oficial Especializado)
  basicHourlyRate: number; // Valor hora de bolsillo/básico
  socialChargesPercent: number; // % Cargas Sociales, Fondo Desempleo, Presentismo
  insurancePercent: number; // % Seguros y otros
  description?: string;
  family?: CostFamily; // Optional override, defaults to MANO DE OBRA
}

// --- CREW (CUADRILLAS) ---
export interface CrewComposition {
  laborCategoryId: string;
  count: number;
  participation?: number; // % de incidencia (Defecto 100). Ej: 50% si el ayudante es compartido.
}

export interface Crew {
  id: string;
  organizationId: string;
  name: string; // Ej: "Cuadrilla Hormigón (1+3)"
  description?: string;
  composition: CrewComposition[]; // Lista de integrantes
}

// --- STANDARD YIELDS SCHEMA (CHANDÍAS BASELINE) ---
export interface StandardYields {
    materials?: { materialId: string; quantity: number; wastePercent: number }[];
    labor?: { laborCategoryId: string; hhPerUnit: number }[]; // HH por unidad
    equipment?: { toolId: string; hoursPerUnit: number }[];
}

export interface Task {
  id: string;
  organizationId: string; // Multitenant
  name: string; 
  description?: string; // NEW: Extended description
  unit: string; 
  laborCost: number; // Costo Manual (Legacy o Alternativo)
  dailyYield: number; // Rendimiento Diario Standard (u/dia)
  category?: string;
  
  // NEW: Costos fijos por unidad (Fletes, Ayuda Gremio, Subcontrato específico)
  fixedCost?: number; 
  fixedCostDescription?: string;
  
  // NEW: Excel Import Fields
  code?: string; // Código de Tarea (Columna 0 del Excel)
  specifications?: string; // Especificación Técnica (Columna 6 del Excel)

  // NEW: Engineering Standard (Coscarella / Chandías)
  yieldHH?: number; // Rendimiento en Horas Hombre por Unidad (hh/u)
  defaultPredecessorId?: string; // Sugerencia de secuencia lógica (precedenciaId)

  // NEW: Baseline for Comparison (The "Standard" vs the "Real" in Context)
  standardYields?: StandardYields; 

  // NEW: Virtual properties for Sync (Pass-through objects)
  materialsYield?: TaskYield[];
  equipmentYield?: TaskToolYield[];
  laborYield?: TaskCrewYield[]; 
  laborIndividualYield?: TaskLaborYield[]; // New (Individuals)
}

export interface TaskYield {
  taskId: string;
  materialId: string;
  quantity: number; // Cantidad Neta
  wastePercent?: number; // Desperdicio Real Adicional
}

export interface TaskToolYield {
  taskId: string;
  toolId: string;
  hoursPerUnit: number;
}

export interface TaskCrewYield {
  taskId: string;
  crewId: string;
  quantity: number; // Cantidad de cuadrillas asignadas (usualmente 1)
}

export interface TaskLaborYield {
  taskId: string;
  laborCategoryId: string;
  quantity: number; // Cantidad de oficiales (ej: 0.5, 1, 2)
}



export interface Holiday {
  date: string; // YYYY-MM-DD
  description: string;
}

export interface CalendarPreset {
  id: string;
  name: string;
  workdayHours: number;
  workdayStartTime: string;
  workdayEndTime: string;
  lunchBreakDuration: number;
  workingDays: number[];
  nonWorkingDates: Holiday[];
}

// Estructura de Gastos Indirectos (PDF Costos)
export interface PricingConfig {
    generalExpensesPercent: number; // Gastos Generales (GGO + GGE) -> COSTO INDIRECTO
    financialExpensesPercent: number; // Gastos Financieros
    profitPercent: number; // Beneficio / Utilidad
    taxPercent: number; // Impuestos (IVA/IIBB)
}

// NEW: Helper interfaces for Project specific labor definition
export interface ProjectLaborDefinition {
    laborCategoryId: string;
    count: number;
}

export interface ProjectCrewDefinition {
    crewId: string;
    count: number;
}

export type ProjectStatus = 'planning' | 'active' | 'completed' | 'suspended';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';

export interface Project {
  id: string;
  organizationId: string; // Multitenant
  name: string;
  client: string; // Client Name (Display)
  clientId?: string; // Foreign Key to Client/User
  address?: string;
  companyName?: string;
  currency: string;
  startDate: string;
  endDate?: string; // Fecha de Fin Prevista / Límite
  status: ProjectStatus; // NEW: Status field
  items: BudgetItem[];
  
  // Global Settings for Labor & Calendar
  workdayHours?: number; // Jornada laboral standard (ej 8 o 9hs) - Calculated or Manual
  workdayStartTime?: string; // "08:00"
  workdayEndTime?: string; // "17:00"
  lunchBreakDuration?: number; // in minutes
  workingDays?: number[]; // Array of days (0=Sun, 1=Mon... 6=Sat) that are working days
  nonWorkingDates?: Holiday[]; // Array of specific dates with descriptions
  
  globalEfficiency?: number; // Factor de rendimiento (ej 0.85)
  // Technical Specs
  surface?: number; // Superficie en m2
  constructionSystem?: string; // Tradicional, Steel Frame, etc.
  structureType?: string; // Hormigón, Metálica, etc.
  foundationType?: string; // Platea, Zapatas, etc.

  // Pricing Structure
  pricing?: PricingConfig;

  // NEW: Project Specific Resource Availability
  laborForce?: ProjectLaborDefinition[]; // Available individual workers
  assignedCrews?: ProjectCrewDefinition[]; // Available crews
}

export interface BudgetItem {
  id: string;
  taskId: string; // Foreign Key to Master Task
  
  // Project-Specific Overrides (The "Task" entity in the requested schema)
  name?: string; // Nombre de la tarea (Override)
  description?: string; // Descripcion (Override)
  
  quantity: number; 
  
  // Planning / Scheduling
  startDate?: string; // FechaInicioEstimada
  endDate?: string; // FechaFinEstimada (Calculated or Manual)
  manualDuration?: number; // Duración forzada por el usuario
  
  responsibleId?: string; // ResponsableID (Foreign Key to User/Personal)
  status?: TaskStatus; // Estado
  
  dependencies?: Dependency[]; // Vinculaciones
  progress?: number; // Porcentaje de avance (0-100)
  
  // NEW: Planning specific overrides based on Methods & Time Study
  crewsAssigned?: number; // Frentes de ataque (Cant_Personal en fórmula Coscarella)
  efficiencyFactor?: number; // Valoración del Ritmo (fv). 1.0 = Normal (100%), 1.2 = Rápido, 0.8 = Lento
  allowancePercent?: number; // Suplementos (Fatiga, Necesidades, Contingencias). Ej: 15%

  // NEW: Tracking & Actuals (Seguimiento Real)
  actualStartDate?: string; // Fecha Real de Inicio
  actualEndDate?: string; // Fecha Real de Fin
  trackingNotes?: string; // Observaciones de seguimiento (ej: "Demora por lluvia")
}

// --- RECEPTION MODULE ---
export interface ReceptionItem {
  materialId: string;
  quantityDeclared: number; // Lo que dice el remito
  quantityReceived: number; // Lo que realmente entró (puede haber roturas)
  notes?: string;
}

export interface Reception {
  id: string;
  organizationId: string; // Multitenant
  projectId: string;
  date: string;
  remitoNumber: string;
  provider?: string;
  photoUrl?: string; // Base64 or URL
  items: ReceptionItem[];
  status: 'draft' | 'confirmed';
}

// --- SUBCONTRACTORS MODULE ---

export interface SubcontractorDocument {
    id: string;
    type: 'ART' | 'VIDA' | 'SVO' | 'CONTRATO' | 'OTRO';
    name: string;
    expirationDate: string;
    isValid: boolean;
}

export interface Subcontractor {
    id: string;
    organizationId: string; // Multitenant
    name: string;
    cuit: string;
    category: string; // Electricidad, Plomería, Albañilería
    phone?: string;
    email?: string;
    documents: SubcontractorDocument[];
}

export interface ContractItem {
    budgetItemId: string; // Link to project BudgetItem
    taskId: string; // Redundant but useful for UI
    agreedUnitPrice: number; // Puede diferir del presupuesto oficial
}

export interface Contract {
    id: string;
    organizationId: string; // Multitenant
    subcontractorId: string;
    projectId: string;
    description: string;
    startDate: string;
    retentionPercent: number; // Fondo de reparo (ej: 5%)
    items: ContractItem[];
    status: 'active' | 'closed' | 'draft';
}

export interface CertificationItem {
    contractItemId: string; // ID del ContractItem (task)
    percentageThisPeriod: number; // Avance del periodo
    amountThisPeriod: number; // Dinero del periodo
}

export interface Certification {
    id: string;
    organizationId: string; // Multitenant
    contractId: string;
    date: string;
    period: string; // "MM-YYYY"
    items: CertificationItem[];
    totalGross: number; // Bruto
    retentionAmount: number; // Retención calculada
    totalNet: number; // A pagar (Bruto - Retención)
    status: 'pending' | 'approved' | 'paid';
    evidenceUrl?: string; // URL de fotos analizadas por Visión Artificial
    approvalStatus?: 'pending_review' | 'approved' | 'rejected';
}

// --- DOCUMENT MANAGEMENT MODULE ---
export interface ProjectDocument {
    id: string;
    organizationId: string;
    projectId: string;
    name: string;
    type: 'PLAN' | 'CONTRACT' | 'INVOICE' | 'SPEC' | 'OTHER';
    format: 'PDF' | 'DWG' | 'XLSX' | 'JPG' | 'IFC' | 'DOCX';
    uploadDate: string;
    uploadedBy: string; // User ID/Name
    metadata?: Record<string, any>; // Extracted Metadata (Spatial coords, etc)
    url?: string; // Mock URL
}

// --- MEASUREMENT SHEETS (CÓMPUTOS MÉTRICOS) ---
export interface MeasurementLine {
    id: string;
    description: string; // "Muro Eje A", "Columna C1"
    length: number;
    width: number;
    height: number;
    count: number; // Cantidad de veces que se repite
    subtotal: number; // Calculated (L*W*H*Count) or manually overridden
}

export interface MeasurementSheet {
    id: string; // Unique ID
    organizationId: string;
    budgetItemId: string; // Link to specific budget item (The Bridge)
    lines: MeasurementLine[];
    totalQuantity: number;
    lastUpdated: string;
    updatedBy: string;
}

// --- QUALITY MANAGEMENT MODULE (GESTION DE CALIDAD) ---

export type ControlType = 'variable' | 'attribute';

export interface QualityCheckItem {
    id: string;
    description: string; // "Verificar plomo", "Asentamiento (Slump)"
    type: ControlType;
    acceptanceCriteria?: string; // "≤ 2mm/m", "Sin fisuras visibles", "10 +/- 2 cm"
    // For Variables (Numeric)
    unit?: string;
    minValue?: number;
    maxValue?: number;
}

export interface QualityProtocol {
    id: string;
    organizationId: string;
    name: string; // e.g. "Protocolo de Hormigonado", "Control de Mampostería"
    category: string; // Rubro associated
    checks: QualityCheckItem[];
}

export interface QualityInspection {
    id: string;
    organizationId: string;
    projectId: string;
    taskId: string; // Linked to a BudgetItem/Task
    protocolId: string;
    date: string;
    inspector: string; // User Name
    status: 'passed' | 'failed' | 'conditional';
    // Results store: key = checkItem.id, value = number (variable) or boolean (attribute)
    results: Record<string, any>; 
    comments?: string;
    photos?: string[];
}

export interface NonConformity {
    id: string;
    organizationId: string;
    projectId: string;
    inspectionId?: string; // Linked to an inspection (optional, can be standalone)
    date: string;
    description: string;
    severity: 'critical' | 'major' | 'minor'; // From PDF Slide 31
    correctiveAction: string;
    status: 'open' | 'closed';
    assignedTo?: string; // Responsible person
}

export interface ComputationResult {
    id: string;
    organizationId: string;
    projectId: string;
    budgetItemId: string; // The item this calculation belongs to
    computationTaskId: string; // The template used (e.g., "Muro 0.15")
    inputValues: Record<string, any>; // e.g. { "Largo": 5, "Alto": 3 }
    resultQuantity: number; // The calculated result
    createdAt: string;
}

export interface ComputationParameter {
    name: string;
    type: 'number' | 'string' | 'enum';
    unit?: string;
    options?: string[]; // For enum
    min?: number;
    max?: number;
    defaultValue?: any;
}

export interface ComputationTask {
    id: string;
    rubroId: string;
    name: string;
    unit: string;
    description: string;
    parameters: ComputationParameter[];
    formulaExample: string;
    tags: string[];
}

export interface Rubro {
    id: string;
    name: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  rubros: string[];
  tasks: Partial<Task>[];
}

export interface ImportResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface Snapshot {
    id: string;
    organizationId: string;
    projectId: string; // Added projectId
    name: string;
    date: string;
    description?: string;
    totalCost: number;
    items: BudgetItem[];
    materialsSnapshot: Material[];
    data?: any;
}

export interface UnitPriceAnalysis {
    taskId?: string;
    materialCost: number;
    laborCost: number;
    toolCost: number;
    fixedCost: number;
    totalUnitCost: number;
    materials?: any[];
    labor?: any[];
    tools?: any[];
}
