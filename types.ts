// Definición de las entidades base del sistema

export type Role = 'admin' | 'engineering' | 'foreman' | 'client';

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
}

export interface Tool {
  id: string;
  organizationId: string; // Multitenant
  name: string;
  category: string; 
  costPerHour: number; 
}

export interface LaborCategory {
  id: string;
  organizationId: string; // Multitenant
  role: string; // Nombre del rol (ej: Oficial Especializado)
  basicHourlyRate: number; // Valor hora de bolsillo/básico
  socialChargesPercent: number; // % Cargas Sociales y Aportes Patronales
  insurancePercent: number; // % Seguros y otros
  description?: string;
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

export interface Task {
  id: string;
  organizationId: string; // Multitenant
  name: string; 
  unit: string; 
  laborCost: number; // Costo Manual (Legacy o Alternativo)
  dailyYield: number;
  category?: string;
  // NEW: Costos fijos por unidad (Fletes, Ayuda Gremio, Subcontrato específico)
  fixedCost?: number; 
  fixedCostDescription?: string; 
}

export interface TaskYield {
  taskId: string;
  materialId: string;
  quantity: number;
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

export interface BudgetItem {
  id: string;
  taskId: string;
  quantity: number; 
  startDate?: string; // Fecha de inicio específica
  manualDuration?: number; // Duración forzada por el usuario
  dependencies?: Dependency[]; // Vinculaciones
  progress?: number; // Porcentaje de avance (0-100)
  
  // NEW: Planning specific overrides based on Methods & Time Study
  crewsAssigned?: number; // Frentes de ataque
  efficiencyFactor?: number; // Valoración del Ritmo (fv). 1.0 = Normal (100%), 1.2 = Rápido, 0.8 = Lento
  allowancePercent?: number; // Suplementos (Fatiga, Necesidades, Contingencias). Ej: 15%
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

export interface Project {
  id: string;
  organizationId: string; // Multitenant
  name: string;
  client: string;
  address?: string;
  companyName?: string;
  currency: string;
  startDate: string;
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
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Task[]; // Tareas a crear
  rubros: string[]; // Rubros necesarios
}

export interface UnitPriceAnalysis {
  taskId: string;
  materialCost: number;
  laborCost: number;
  toolCost: number; 
  fixedCost: number; // NEW
  totalUnitCost: number;
}

export interface ImportResult {
  success: boolean;
  message: string;
  details?: string[];
}

export interface Snapshot {
  id: string;
  organizationId: string; // Multitenant
  date: string;
  name: string;
  totalCost: number;
  items: BudgetItem[]; // Copia profunda de items
  materialsSnapshot?: Material[]; // Copia de precios de materiales al momento del snapshot
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
    format: 'PDF' | 'DWG' | 'XLSX' | 'JPG' | 'IFC';
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