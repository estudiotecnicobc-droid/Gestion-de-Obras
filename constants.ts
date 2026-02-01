import { Material, Task, TaskYield, TaskToolYield, Tool, Project, LaborCategory, ProjectTemplate, CalendarPreset, Crew, TaskCrewYield } from './types';

export const INITIAL_RUBROS = [
  "01 DEMOLICIONES",
  "02 TRABAJOS PRELIMINARES",
  "03 MOVIMIENTO DE SUELOS",
  "04 FUNDACIONES",
  "05 ESTRUCTURAS RESISTENTES",
  "06 MAMPOSTERÍA, Y OTROS CERRAMIENTOS",
  "07 AISLACIONES EN MUROS",
  "08 REVOQUES",
  "09 CONTRAPISOS",
  "10 CARPETAS",
  "11 PISOS",
  "12 ZOCALOS",
  "13 CIELORRASOS",
  "14 REVESTIMIENTOS",
  "15 YESERIA",
  "16 CUBIERTAS",
  "17 CARPINTERÍA METÁLICA Y DE PVC",
  "18 CARPINTERÍA DE MADERA",
  "19 HERRERÍA",
  "20 CORTINAS DE ENROLLAR",
  "21 HERRAJES Y CERRAJERÍA",
  "22 CONDUCTOS Y VENTILACIONES",
  "23 INSTALACIÓN SANITARIA",
  "24 INSTALACIÓN CONTRA INCENDIO",
  "25 INSTALACIÓN DE GAS",
  "26 INSTALACIÓN ELÉCTRICA",
  "27 INSTALACIÓN DE ELECTROMECANICAS",
  "28 CALEFACCIÓN",
  "29 AIRE ACONDICIONADO",
  "30 EQUIPAMIENTO",
  "31 AMOBLAMIENTO",
  "32 TERMINACIONES ESPECIALES",
  "33 VIDRIOS, CRISTALES, ESPEJOS",
  "34 PINTURA",
  "35 OBRAS EXTERIORES",
  "36 SISTEMAS DE COMUNICACIONES",
  "37 SISTEMAS ELECTRÓNICOS Y DE SEGURIDAD",
  "38 DOCUMENTOS CONFORME A OBRA",
  "90 AUXILIARES",
  "91 MEZCLAS",
  "92 HORMIGONES",
  "93 AISLACIONES Y MEMBRANAS",
  "94 SELLADORES Y JUNTAS",
  "95 COSTO OPERATIVO EQUIPOS"
];

// Opciones para listas desplegables
export const CONSTRUCTION_SYSTEMS = [
  "Tradicional (Mampostería Portante)",
  "Tradicional (Estructura Independiente)",
  "Steel Framing (Estructura de Acero)",
  "Wood Framing (Estructura de Madera)",
  "Industrializado / Premoldeado",
  "Mixto"
];

export const STRUCTURE_TYPES = [
  "Hormigón Armado in Situ",
  "Estructura Metálica",
  "Muros Portantes Cerámicos",
  "Muros de Hormigón",
  "Madera Laminada",
  "Sin Estructura Independiente"
];

export const FOUNDATION_TYPES = [
  "Zapata Corrida",
  "Bases Aisladas y Vigas de Riostra",
  "Platea de Fundación",
  "Pilotes con Cabezales",
  "Micropilotes",
  "Viga de Encadenado Simple"
];

// Calendar Presets
export const INITIAL_CALENDAR_PRESETS: CalendarPreset[] = [
  {
    id: 'cal_standard',
    name: 'Estándar Administración (L-V)',
    workdayHours: 9,
    workdayStartTime: "08:00",
    workdayEndTime: "17:00",
    lunchBreakDuration: 60,
    workingDays: [1, 2, 3, 4, 5],
    nonWorkingDates: []
  },
  {
    id: 'cal_construction',
    name: 'Obra Extendida (L-S)',
    workdayHours: 9,
    workdayStartTime: "07:30",
    workdayEndTime: "17:30",
    lunchBreakDuration: 60,
    workingDays: [1, 2, 3, 4, 5, 6], // Incluye Sábado
    nonWorkingDates: []
  }
];

// Plantillas de Precarga
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tmpl_vivienda_trad',
    name: 'Vivienda Unifamiliar (Tradicional)',
    description: 'Listado completo para una casa de ladrillo y hormigón.',
    rubros: INITIAL_RUBROS,
    tasks: [
      { id: 'gen_1', organizationId: 'org_a', name: 'Limpieza de Terreno y Replanteo', unit: 'm2', laborCost: 2.5, dailyYield: 50, category: '02 TRABAJOS PRELIMINARES' },
      { id: 'gen_2', organizationId: 'org_a', name: 'Excavación de Zapatas (Manual)', unit: 'm3', laborCost: 15, dailyYield: 3, category: '03 MOVIMIENTO DE SUELOS' },
      { id: 'gen_3', organizationId: 'org_a', name: 'Hormigón de Limpieza', unit: 'm2', laborCost: 5, dailyYield: 20, category: '04 FUNDACIONES' },
      { id: 'gen_4', organizationId: 'org_a', name: 'Zapata Corrida H°A°', unit: 'm3', laborCost: 45, dailyYield: 4, category: '04 FUNDACIONES' },
      { id: 'gen_5', organizationId: 'org_a', name: 'Capa Aisladora Horizontal', unit: 'm2', laborCost: 12, dailyYield: 15, category: '07 AISLACIONES EN MUROS' },
      { id: 'gen_6', organizationId: 'org_a', name: 'Mampostería Ladrillo Común 15cm', unit: 'm2', laborCost: 18, dailyYield: 6, category: '06 MAMPOSTERÍA, Y OTROS CERRAMIENTOS' },
      { id: 'gen_7', organizationId: 'org_a', name: 'Mampostería Ladrillo Hueco 18x18x33', unit: 'm2', laborCost: 14, dailyYield: 9, category: '06 MAMPOSTERÍA, Y OTROS CERRAMIENTOS' },
      { id: 'gen_8', organizationId: 'org_a', name: 'Encadenado Superior H°A° 20x20', unit: 'ml', laborCost: 10, dailyYield: 12, category: '05 ESTRUCTURAS RESISTENTES' },
      { id: 'gen_9', organizationId: 'org_a', name: 'Losa Viguetas y Ladrillos Sap', unit: 'm2', laborCost: 22, dailyYield: 15, category: '05 ESTRUCTURAS RESISTENTES' },
      { id: 'gen_10', organizationId: 'org_a', name: 'Contrapiso sobre terreno natural', unit: 'm2', laborCost: 8, dailyYield: 20, category: '09 CONTRAPISOS' },
      { id: 'gen_11', organizationId: 'org_a', name: 'Carpeta Cementicia', unit: 'm2', laborCost: 9, dailyYield: 25, category: '10 CARPETAS' },
      { id: 'gen_12', organizationId: 'org_a', name: 'Revoque Grueso Interior', unit: 'm2', laborCost: 11, dailyYield: 12, category: '08 REVOQUES' },
      { id: 'gen_13', organizationId: 'org_a', name: 'Revoque Fino Interior', unit: 'm2', laborCost: 13, dailyYield: 15, category: '08 REVOQUES' },
      { id: 'gen_14', organizationId: 'org_a', name: 'Colocación Piso Cerámico', unit: 'm2', laborCost: 16, dailyYield: 10, category: '11 PISOS' },
      { id: 'gen_15', organizationId: 'org_a', name: 'Pintura Látex Muros (2 manos)', unit: 'm2', laborCost: 6, dailyYield: 30, category: '34 PINTURA' },
    ]
  },
  {
    id: 'tmpl_steel_frame',
    name: 'Obra Seca (Steel Framing)',
    description: 'Estructura metálica liviana y emplacados.',
    rubros: INITIAL_RUBROS,
    tasks: [
      { id: 'st_1', organizationId: 'org_a', name: 'Platea de Fundación H°A°', unit: 'm3', laborCost: 35, dailyYield: 10, category: '04 FUNDACIONES' },
      { id: 'st_2', organizationId: 'org_a', name: 'Panelizado Muros Exteriores (PGU/PGC)', unit: 'm2', laborCost: 25, dailyYield: 15, category: '05 ESTRUCTURAS RESISTENTES' },
      { id: 'st_3', organizationId: 'org_a', name: 'Panelizado Muros Interiores (PGU/PGC)', unit: 'm2', laborCost: 20, dailyYield: 20, category: '05 ESTRUCTURAS RESISTENTES' },
      { id: 'st_4', organizationId: 'org_a', name: 'Rigidización OSB 11.1mm', unit: 'm2', laborCost: 8, dailyYield: 40, category: '06 MAMPOSTERÍA, Y OTROS CERRAMIENTOS' },
      { id: 'st_5', organizationId: 'org_a', name: 'Barrera de Agua y Viento (Tyvek)', unit: 'm2', laborCost: 3, dailyYield: 100, category: '07 AISLACIONES EN MUROS' },
      { id: 'st_6', organizationId: 'org_a', name: 'Emplacado Exterior (Cementicia)', unit: 'm2', laborCost: 15, dailyYield: 20, category: '14 REVESTIMIENTOS' },
      { id: 'st_7', organizationId: 'org_a', name: 'Aislación Lana de Vidrio', unit: 'm2', laborCost: 5, dailyYield: 50, category: '07 AISLACIONES EN MUROS' },
      { id: 'st_8', organizationId: 'org_a', name: 'Emplacado Interior (Yeso)', unit: 'm2', laborCost: 12, dailyYield: 25, category: '15 YESERIA' },
      { id: 'st_9', organizationId: 'org_a', name: 'Masillado y Encintado Juntas', unit: 'm2', laborCost: 8, dailyYield: 30, category: '34 PINTURA' },
    ]
  }
];

export const INITIAL_MATERIALS: Material[] = [
  { id: 'm1', organizationId: 'org_a', name: 'Cemento Portland', unit: 'bolsa 50kg', cost: 8.50, category: 'Aglomerantes', provider: 'Construmart', minStock: 50 },
  { id: 'm2', organizationId: 'org_a', name: 'Arena Fina', unit: 'm3', cost: 25.00, category: 'Áridos', provider: 'Arenera Local', minStock: 10 },
  { id: 'm3', organizationId: 'org_a', name: 'Ladrillo Hueco 12x18x33', unit: 'unidad', cost: 0.45, category: 'Mampuestos', provider: 'Cerámica Norte', minStock: 1000 },
  { id: 'm4', organizationId: 'org_a', name: 'Hierro 8mm', unit: 'barra 12m', cost: 12.00, category: 'Metales', provider: 'Aceros SA', minStock: 100 },
  { id: 'm5', organizationId: 'org_a', name: 'Pintura Látex Interior', unit: 'litro', cost: 6.50, category: 'Terminaciones', provider: 'Pinturas Color', minStock: 20 },
];

export const INITIAL_TOOLS: Tool[] = [
  { id: 'eq1', organizationId: 'org_a', name: 'Hormigonera 130L', category: 'Maquinaria Ligera', costPerHour: 2.50 },
  { id: 'eq2', organizationId: 'org_a', name: 'Andamio Tubular', category: 'Estructuras', costPerHour: 0.80 },
  { id: 'eq3', organizationId: 'org_a', name: 'Rodillo Profesional', category: 'Herramienta Manual', costPerHour: 0.10 },
  { id: 'eq4', organizationId: 'org_a', name: 'Vibrador de Hormigón', category: 'Maquinaria Ligera', costPerHour: 3.00 },
];

export const INITIAL_TASKS: Task[] = [
  { id: 't1', organizationId: 'org_a', name: 'Mampostería Ladrillo Hueco', unit: 'm2', laborCost: 15.00, dailyYield: 8, category: '06 MAMPOSTERÍA, Y OTROS CERRAMIENTOS' },
  { id: 't2', organizationId: 'org_a', name: 'Revoque Fino', unit: 'm2', laborCost: 10.00, dailyYield: 12, category: '08 REVOQUES' },
  { id: 't3', organizationId: 'org_a', name: 'Losa de Hormigón Armado', unit: 'm3', laborCost: 80.00, dailyYield: 4, category: '05 ESTRUCTURAS RESISTENTES' },
  { id: 't4', organizationId: 'org_a', name: 'Pintura Muros', unit: 'm2', laborCost: 5.00, dailyYield: 25, category: '34 PINTURA' },
];

export const INITIAL_LABOR_CATEGORIES: LaborCategory[] = [
  { id: 'lc1', organizationId: 'org_a', role: 'Oficial Especializado', basicHourlyRate: 5.50, socialChargesPercent: 45, insurancePercent: 5, description: 'Personal altamente calificado' },
  { id: 'lc2', organizationId: 'org_a', role: 'Oficial', basicHourlyRate: 4.80, socialChargesPercent: 45, insurancePercent: 5, description: 'Mano de obra calificada standard' },
  { id: 'lc3', organizationId: 'org_a', role: 'Medio Oficial', basicHourlyRate: 4.20, socialChargesPercent: 45, insurancePercent: 5, description: 'Aprendiz avanzado' },
  { id: 'lc4', organizationId: 'org_a', role: 'Ayudante', basicHourlyRate: 3.50, socialChargesPercent: 45, insurancePercent: 5, description: 'Tareas generales y asistencia' },
];

export const INITIAL_CREWS: Crew[] = [
  { 
    id: 'cr1', organizationId: 'org_a', name: 'Cuadrilla Básica (1+1)', description: '1 Oficial + 1 Ayudante', 
    composition: [
      { laborCategoryId: 'lc2', count: 1 },
      { laborCategoryId: 'lc4', count: 1 }
    ]
  },
  { 
    id: 'cr2', organizationId: 'org_a', name: 'Cuadrilla Hormigón (1+3)', description: '1 Oficial + 3 Ayudantes', 
    composition: [
      { laborCategoryId: 'lc2', count: 1 },
      { laborCategoryId: 'lc4', count: 3 }
    ]
  }
];

export const INITIAL_YIELDS: TaskYield[] = [
  { taskId: 't1', materialId: 'm1', quantity: 0.2 },
  { taskId: 't1', materialId: 'm2', quantity: 0.03 },
  { taskId: 't1', materialId: 'm3', quantity: 16 },
  { taskId: 't2', materialId: 'm1', quantity: 0.1 },
  { taskId: 't2', materialId: 'm2', quantity: 0.02 },
  { taskId: 't4', materialId: 'm5', quantity: 0.25 },
  // Losa (concreto)
  { taskId: 't3', materialId: 'm1', quantity: 7 }, // 7 bolsas por m3
  { taskId: 't3', materialId: 'm2', quantity: 0.7 }, // 0.7 m3 arena
  { taskId: 't3', materialId: 'm4', quantity: 12 }, // Hierro
];

export const INITIAL_TOOL_YIELDS: TaskToolYield[] = [
  // Mampostería usa andamio
  { taskId: 't1', toolId: 'eq2', hoursPerUnit: 0.5 },
  // Revoque usa andamio y hormigonera (mezcla)
  { taskId: 't2', toolId: 'eq2', hoursPerUnit: 0.5 },
  { taskId: 't2', toolId: 'eq1', hoursPerUnit: 0.1 },
  // Losa usa hormigonera y vibrador
  { taskId: 't3', toolId: 'eq1', hoursPerUnit: 1.5 },
  { taskId: 't3', toolId: 'eq4', hoursPerUnit: 0.5 },
  // Pintura usa rodillo
  { taskId: 't4', toolId: 'eq3', hoursPerUnit: 0.1 },
];

export const INITIAL_CREW_YIELDS: TaskCrewYield[] = [
    { taskId: 't3', crewId: 'cr2', quantity: 1 }, // Losa usa cuadrilla hormigón
];

export const INITIAL_PROJECT: Project = {
  id: 'p1',
  organizationId: 'org_a',
  name: 'Residencia Familia Pérez',
  client: 'Juan Pérez',
  address: 'Av. Libertador 1234',
  companyName: 'Constructora Ejemplo S.A.',
  currency: '$',
  startDate: new Date().toISOString().split('T')[0],
  
  // Settings Default
  workdayHours: 9,
  workdayStartTime: "08:00",
  workdayEndTime: "17:00",
  lunchBreakDuration: 60,
  workingDays: [1, 2, 3, 4, 5], // Lunes a Viernes
  nonWorkingDates: [], // Sin feriados iniciales

  globalEfficiency: 0.85,
  surface: 120,
  constructionSystem: 'Tradicional (Mampostería Portante)',
  structureType: 'Hormigón Armado in Situ',
  foundationType: 'Zapata Corrida',
  items: [
    { id: 'bi1', taskId: 't1', quantity: 120 }, 
    { id: 'bi2', taskId: 't2', quantity: 240 }, 
    { id: 'bi3', taskId: 't4', quantity: 240 }, 
  ]
};