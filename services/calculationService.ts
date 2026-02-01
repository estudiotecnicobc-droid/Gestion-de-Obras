import { Material, Task, TaskYield, TaskToolYield, Tool, UnitPriceAnalysis, Holiday, TaskCrewYield, Crew, LaborCategory } from '../types';

// Helper to calculate labor cost total (with social charges)
const calculateHourlyLaborCost = (lc: LaborCategory) => {
    return (lc.basicHourlyRate || 0) * (1 + ((lc.socialChargesPercent || 0) + (lc.insurancePercent || 0)) / 100);
};

// Optimized Calculation using Maps/Indexes for O(1) access
export const calculateUnitPrice = (
  task: Task,
  yieldsIndex: Record<string, TaskYield[]>, // Pre-indexed by taskId
  materialsMap: Record<string, Material>,   // Pre-indexed by materialId
  toolYieldsIndex: Record<string, TaskToolYield[]>, // Pre-indexed by taskId
  toolsMap: Record<string, Tool>,            // Pre-indexed by toolId
  // New Crew params (optional for backward compact)
  taskCrewYieldsIndex?: Record<string, TaskCrewYield[]>,
  crewsMap?: Record<string, Crew>,
  laborCategoriesMap?: Record<string, LaborCategory>,
  workdayHours: number = 9
): UnitPriceAnalysis => {
  
  // 1. Calculate Materials Cost
  const taskYields = yieldsIndex[task.id] || [];
  let totalMaterialCost = 0;
  
  for (const y of taskYields) {
    const material = materialsMap[y.materialId];
    if (material) {
      totalMaterialCost += (material.cost || 0) * y.quantity;
    }
  }

  // 2. Calculate Tools Cost
  const taskToolYields = toolYieldsIndex[task.id] || [];
  let totalToolCost = 0;

  for (const y of taskToolYields) {
    const tool = toolsMap[y.toolId];
    if (tool) {
      totalToolCost += (tool.costPerHour || 0) * y.hoursPerUnit;
    }
  }

  // 3. Calculate Labor Cost (Manual OR Derived from Crews)
  let derivedLaborCost = 0;
  
  if (taskCrewYieldsIndex && crewsMap && laborCategoriesMap) {
      const crewYields = taskCrewYieldsIndex[task.id] || [];
      
      for (const cy of crewYields) {
          const crew = crewsMap[cy.crewId];
          if (crew) {
              // Calculate Crew Hourly Cost
              let crewHourlyCost = 0;
              crew.composition.forEach(member => {
                  const category = laborCategoriesMap[member.laborCategoryId];
                  if (category) {
                      // Apply participation factor (default 100%)
                      const participation = (member.participation ?? 100) / 100;
                      crewHourlyCost += (calculateHourlyLaborCost(category) * member.count * participation);
                  }
              });

              // Crew Unit Cost = (CrewHourly * WorkdayHours * Quantity) / DailyYield
              if ((task.dailyYield || 0) > 0) {
                  derivedLaborCost += (crewHourlyCost * workdayHours * cy.quantity) / task.dailyYield;
              }
          }
      }
  }

  // If crews are assigned, use derived cost plus any manual override, or default to manual if no crews
  const baseLabor = task.laborCost || 0;
  const laborCost = derivedLaborCost > 0 ? derivedLaborCost + baseLabor : baseLabor;

  // 4. Fixed / Additional Costs (Flete, Ayuda de Gremio, etc.)
  const fixedCost = task.fixedCost || 0;

  return {
    taskId: task.id,
    materialCost: Number(totalMaterialCost.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    toolCost: Number(totalToolCost.toFixed(2)),
    fixedCost: Number(fixedCost.toFixed(2)),
    totalUnitCost: Number((totalMaterialCost + laborCost + totalToolCost + fixedCost).toFixed(2)),
  };
};

/**
 * Calculates duration in days based on Quantity and Daily Yield.
 * Updated to incorporate Method & Time Study concepts (Coscarella):
 * - Crews: "Frente de ataque"
 * - Efficiency (fv): "Valoración del ritmo" (1.0 normal, 1.2 fast, 0.8 slow)
 * - Allowances (Suplementos): Fatiga, Necesidades, Contingencias (increases time)
 * 
 * Formula: Standard Time = Normal Time * (1 + Supplements)
 * Where Normal Time depends on Yield * Efficiency.
 */
export const calculateDuration = (
    quantity: number, 
    dailyYield: number, 
    crewsAssigned: number = 1,
    efficiencyFactor: number = 1.0, // fv
    allowancePercent: number = 0 // % Suplementos
): number => {
  if (!dailyYield || dailyYield <= 0) return 1;
  
  // 1. Base Output (Producción Normal Diaria) = Rendimiento Base * Cuadrillas * Eficiencia
  const normalDailyOutput = dailyYield * Math.max(1, crewsAssigned) * efficiencyFactor;
  
  // 2. Adjusted Output considering Allowances (Suplementos reduces effective time/output)
  // If Time increases by (1 + allowance), Output decreases by 1 / (1 + allowance)
  const effectiveDailyOutput = normalDailyOutput / (1 + (allowancePercent / 100));

  return Math.ceil(quantity / effectiveDailyOutput);
};

export const addDays = (date: string | Date, days: number): string => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().split('T')[0];
};

/**
 * Adds duration (in working days) to a start date, skipping non-working days and specific holidays.
 * @param startDate String YYYY-MM-DD
 * @param duration Number of working days
 * @param workingDays Array of allowed days (0=Sun, 1=Mon, ..., 6=Sat)
 * @param nonWorkingDates Array of Holiday objects or strings (backward compatibility)
 */
export const addWorkingDays = (
    startDate: string, 
    duration: number, 
    workingDays: number[] = [1,2,3,4,5],
    nonWorkingDates: Holiday[] = []
): string => {
    let current = new Date(startDate);
    // If duration is 1, it starts and ends on the same day (if valid).
    // We need to add (duration - 1) days of work.
    let daysToAdd = Math.max(0, duration - 1);
    
    // Extract strings for easy comparison
    const holidayStrings = new Set(nonWorkingDates.map(h => h.date));

    const isWorkingDay = (d: Date) => {
        const dayOfWeek = d.getDay();
        const dateStr = d.toISOString().split('T')[0];
        // Check weekly recurrence AND specific holidays
        return workingDays.includes(dayOfWeek) && !holidayStrings.has(dateStr);
    };

    // Check if start date is valid, if not, move to next valid day first 
    // (In strict CPM, start date usually matters, but here we push forward if start falls on holiday)
    while (!isWorkingDay(current)) {
        current.setDate(current.getDate() + 1);
    }

    while (daysToAdd > 0) {
        current.setDate(current.getDate() + 1);
        if (isWorkingDay(current)) {
            daysToAdd--;
        }
    }
    return current.toISOString().split('T')[0];
};

export const diffDays = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  // Add 1 to include the last day
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};