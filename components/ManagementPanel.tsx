import React, { useMemo, useState, useRef } from 'react';
import { printDocument } from '../utils/printDocument';
import { generateId } from '../utils/generateId';
import { useERP } from '../context/ERPContext';
import { ProjectCertificate, ProjectCertificateItem } from '../types';
import { calculateUnitPrice, addDays, calculateDuration } from '../services/calculationService';
import { useProjectSchedule } from '../hooks/useProjectSchedule';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart, ReferenceLine, ScatterChart, Scatter, ZAxis, Bar
} from 'recharts';
import { 
  TrendingUp, AlertTriangle, FileCheck, DollarSign, Calendar, 
  Printer, X, ZoomIn, ZoomOut, Image as ImageIcon, Briefcase, FileText,
  Activity, Target, Calculator, Clock, Zap, FastForward, Info, Users, Layers
} from 'lucide-react';

export const ManagementPanel: React.FC = () => {
  const {
    project, tasks, materials, yields, tools, toolYields, snapshots, receptions,
    yieldsIndex, materialsMap, toolYieldsIndex, toolsMap,
    taskCrewYieldsIndex, crewsMap, laborCategoriesMap, taskLaborYieldsIndex,
    projectCertificates, addProjectCertificate
  } = useERP();

  const { evm: evmStats, itemCosts } = useProjectSchedule();
  
  // --- States for Certificate ---
  // previewCert: certificado a mostrar en el modal (null = modal cerrado).
  // Siempre muestra un snapshot guardado; no hay "preview en vivo sin guardar".
  const [previewCert, setPreviewCert] = useState<ProjectCertificate | null>(null);
  const [certPeriod, setCertPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [certScale, setCertScale] = useState(1);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const certificatePrintRef = useRef<HTMLDivElement | null>(null);

  const handlePrintCertificate = () => {
    const el = certificatePrintRef.current;
    if (!el) return;
    printDocument({
      title: 'Certificado de Obra',
      html: el.innerHTML,
      pageSize: 'a4',
      pageOrientation: 'portrait',
      pageMargin: '15mm',
    });
  };

  // --- States for Crashing Simulator ---
  const [selectedTaskIdForCrash, setSelectedTaskIdForCrash] = useState<string>('');
  const [crashScenario, setCrashScenario] = useState({
      addedCrews: 0,     // Cuadrillas extra (misma eficiencia, costo lineal)
      overtimePercent: 0 // Horas extra (mayor costo unitario, reduce tiempo)
  });

  // --- 2. S-Curve Data Generation (Enhanced) ---
  const sCurveData = useMemo(() => {
    const startDate = new Date(project.startDate);
    let maxDuration = 0;
    
    // Calc Duration
    project.items.forEach(item => {
        const task = tasks.find(t => t.id === item.taskId);
        if(!task) return;
        const dur = item.manualDuration || calculateDuration(item.quantity, task.dailyYield, item.crewsAssigned || 1);
        const itemEndDay = (new Date(item.startDate || project.startDate).getTime() - startDate.getTime()) / (86400000) + dur;
        if(itemEndDay > maxDuration) maxDuration = itemEndDay;
    });
    if (maxDuration === 0) maxDuration = 30;

    const points = [];
    const weeks = Math.ceil(maxDuration / 7) + 2; 
    const totalBudget = evmStats.BAC; // Use calculated BAC

    for (let w = 0; w <= weeks; w++) {
        const currentDate = addDays(project.startDate, w * 7);
        const dateObj = new Date(currentDate);
        const isFuture = dateObj > new Date();

        // 1. PV (Planned Value) Curve
        let cumulativePlanned = 0;
        if (w <= Math.ceil(maxDuration / 7)) {
            const progress = Math.min(1, w / (maxDuration/7)); 
            const easedProgress = progress * progress * (3 - 2 * progress);
            cumulativePlanned = totalBudget * easedProgress;
        } else {
            cumulativePlanned = totalBudget;
        }

        // 2. AC (Actual Cost) & EV (Earned Value)
        let cumulativeActual = null;
        let cumulativeEarned = null;

        if (!isFuture) {
            // Distribute AC and EV roughly over time until today for visualization
            const weeksPassed = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
            const factor = Math.min(1, w / Math.max(1, weeksPassed));
            
            cumulativeActual = evmStats.AC * factor;
            cumulativeEarned = evmStats.EV * factor;
        }

        points.push({
            name: `Sem ${w}`,
            date: currentDate,
            PV: Math.round(cumulativePlanned),
            AC: cumulativeActual ? Math.round(cumulativeActual) : null,
            EV: cumulativeEarned ? Math.round(cumulativeEarned) : null,
        });
    }
    return points;
  }, [project, tasks, evmStats]);

  // --- ABC (PARETO) ANALYSIS ---
  const abcAnalysis = useMemo(() => {
      // 1. Costos por ítem — ya calculados en useProjectSchedule, sin recálculo.
      const rawItems = itemCosts.map(ic => ({
          id:       ic.id,
          name:     ic.taskName,
          category: ic.category,
          cost:     ic.totalCost,
          quantity: ic.quantity,
          unit:     ic.unit,
      }));

      // 2. Sort descending by Cost
      rawItems.sort((a, b) => b.cost - a.cost);

      // 3. Calculate accumulated %
      const totalProjectCost = rawItems.reduce((acc, curr) => acc + curr.cost, 0);
      let accumulated = 0;
      
      const analyzedItems = rawItems.map(item => {
          accumulated += item.cost;
          const percentage = totalProjectCost > 0 ? (item.cost / totalProjectCost) * 100 : 0;
          const cumulativePercentage = totalProjectCost > 0 ? (accumulated / totalProjectCost) * 100 : 0;
          
          let abcCategory = 'C';
          if (cumulativePercentage <= 80) abcCategory = 'A';
          else if (cumulativePercentage <= 95) abcCategory = 'B';

          return {
              ...item,
              percentage,
              cumulativePercentage,
              abcCategory
          };
      });

      // 4. Stats Grouping
      const stats = {
          A: { count: 0, cost: 0, percentage: 0 },
          B: { count: 0, cost: 0, percentage: 0 },
          C: { count: 0, cost: 0, percentage: 0 },
      };

      analyzedItems.forEach(item => {
          const cat = item.abcCategory as 'A' | 'B' | 'C';
          stats[cat].count++;
          stats[cat].cost += item.cost;
      });

      // Calculate percentages of items
      const totalCount = analyzedItems.length;
      if (totalCount > 0) {
          stats.A.percentage = (stats.A.count / totalCount) * 100;
          stats.B.percentage = (stats.B.count / totalCount) * 100;
          stats.C.percentage = (stats.C.count / totalCount) * 100;
      }

      return {
          items: analyzedItems,
          chartData: analyzedItems.slice(0, 20), // Show top 20 in chart
          stats
      };
  }, [itemCosts]);

  // --- 3. Critical Deviations Logic ---
  const deviations = useMemo(() => {
      const baseline = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null; // Get oldest snapshot (first one)
      if (!baseline || !baseline.materialsSnapshot) return [];

      const diffs: any[] = [];
      materials.forEach(currentMat => {
          const baseMat = baseline.materialsSnapshot?.find(m => m.id === currentMat.id);
          if (baseMat) {
              const increase = currentMat.cost - baseMat.cost;
              const percent = baseMat.cost > 0 ? (increase / baseMat.cost) * 100 : 0;
              
              if (percent > 10) { // Critical Threshold > 10%
                  diffs.push({
                      id: currentMat.id,
                      name: currentMat.name,
                      basePrice: baseMat.cost,
                      currentPrice: currentMat.cost,
                      percent: percent
                  });
              }
          }
      });
      return diffs.sort((a,b) => b.percent - a.percent);
  }, [materials, snapshots]);

  // --- 5. CRASHING SIMULATION LOGIC (PDF 3 Concept) ---
  const crashData = useMemo(() => {
      if (!selectedTaskIdForCrash) return null;
      const budgetItem = project.items.find(i => i.taskId === selectedTaskIdForCrash);
      const task = tasks.find(t => t.id === selectedTaskIdForCrash);
      if (!budgetItem || !task) return null;

      // Base Calculation (Normal Point)
      const baseCrews = budgetItem.crewsAssigned || 1;
      const baseYield = task.dailyYield * baseCrews;
      const normalDuration = Math.ceil(budgetItem.quantity / baseYield);
      const analysis = calculateUnitPrice(task, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap, taskCrewYieldsIndex, crewsMap, laborCategoriesMap, project.workdayHours || 9, taskLaborYieldsIndex);
      const normalCost = analysis.totalUnitCost * budgetItem.quantity;

      // Crash Simulation Points (Curve Points)
      const points = [];
      // Simulate adding 0 to 4 extra crews, and 0%, 50%, 100% overtime
      for (let extraCrews = 0; extraCrews <= 3; extraCrews++) {
          for (let ot = 0; ot <= 100; ot += 50) {
              const totalCrews = baseCrews + extraCrews;
              
              // Yield increases with crews, but OT decreases efficiency slightly (fatigue)
              const otEfficiency = ot > 0 ? (1 - (ot/500)) : 1; // Slight penalty for OT
              const dailyYield = (task.dailyYield * totalCrews) * (1 + (ot/100) * 0.8) * otEfficiency; // OT adds output but not linear 1:1 due to fatigue
              
              const duration = Math.ceil(budgetItem.quantity / dailyYield);
              
              // Cost Calculation
              // Materials: Constant total
              const matCostTotal = analysis.materialCost * budgetItem.quantity;
              
              // Labor: Base + OT Premium (usually +50% or +100%)
              const otPremiumFactor = 1 + (ot > 0 ? (ot/100) * 1.5 : 0); // Cost increases faster than output
              const laborRate = analysis.laborCost * otPremiumFactor; 
              // Labor Total = (Rate * Quantity) but adjusted for new duration? 
              // Simplification: Labor is usually paid by hour/day. 
              // Total Labor = (HourlyRate * HoursPerDay * Days * People)
              // Let's approximate using Unit Cost:
              // Unit Labor Cost increases because efficiency drops with OT and saturation
              const efficiencyLoss = 1 + (extraCrews * 0.05); // Supervision overhead
              const laborCostTotal = (laborRate * budgetItem.quantity) * efficiencyLoss;

              // Equipment: Daily cost * Duration. If duration drops, equipment total drops (Costos Fijos Indirectos)
              // Assuming toolCost in analysis is per Unit based on Yield.
              // If duration decreases, Tool Total Cost should decrease? 
              // Tool Total = (ToolDaily * Duration). 
              // ToolDaily = (ToolUnit * Yield).
              // Let's reverse eng daily tool cost.
              const toolDailyCost = (analysis.toolCost * task.dailyYield * baseCrews); 
              const toolCostTotal = toolDailyCost * duration * (1 + extraCrews); // More tools needed for more crews

              const totalSimCost = matCostTotal + laborCostTotal + toolCostTotal;

              points.push({
                  duration,
                  cost: Math.round(totalSimCost),
                  crews: totalCrews,
                  ot: ot
              });
          }
      }

      // Filter pareto optimal points (lowest cost for each duration)
      const optimalPoints = points.sort((a,b) => b.duration - a.duration);
      
      // Current selected scenario
      const currentCrews = baseCrews + crashScenario.addedCrews;
      const currentOt = crashScenario.overtimePercent;
      
      // Recalc specific scenario for display
      const simYield = (task.dailyYield * currentCrews) * (1 + (currentOt/100) * 0.8);
      const simDuration = Math.ceil(budgetItem.quantity / simYield);
      const daysSaved = normalDuration - simDuration;
      
      // Find cost for this scenario from points (approx)
      const simPoint = points.find(p => p.crews === currentCrews && p.ot === currentOt) || points[0];
      const costIncrease = simPoint.cost - normalCost;
      const costSlope = daysSaved > 0 ? costIncrease / daysSaved : 0;

      return {
          taskName: task.name,
          normalDuration,
          normalCost,
          simDuration,
          simCost: simPoint.cost,
          daysSaved,
          costIncrease,
          costSlope,
          points: optimalPoints
      };

  }, [selectedTaskIdForCrash, crashScenario, project.items, tasks, yieldsIndex, materialsMap, toolYieldsIndex, toolsMap]);


  // --- Handlers ---

  /**
   * Emite un certificado de avance de obra.
   * Congela el estado actual de itemCosts (precios + avance) como snapshot inmutable,
   * lo persiste en allProjectCertificates y abre el modal de preview.
   *
   * Número secuencial: max(números existentes para este proyecto) + 1.
   * previouslyCertified: totalCertified del último certificado emitido (0 si es el primero).
   */
  const handleEmitCertificate = () => {
    const lastCert = projectCertificates[projectCertificates.length - 1]; // ya vienen ordenados por number
    const nextNumber = (lastCert?.number ?? 0) + 1;
    const previouslyCertified = lastCert?.totalCertified ?? 0;

    const certItems: ProjectCertificateItem[] = itemCosts.map(ic => ({
      budgetItemId: ic.id,
      taskId:       ic.taskId,
      description:  ic.taskName,
      unit:         ic.unit,
      quantity:     ic.quantity,
      unitPrice:    ic.unitCost,
      totalBudgeted: ic.totalCost,
      progressPercent: ic.progress,
      amountCertified: ic.earnedValue,
    }));

    const totalCertified = certItems.reduce((acc, i) => acc + i.amountCertified, 0);

    const cert: ProjectCertificate = {
      id:                   generateId(),
      organizationId:       project.organizationId,
      projectId:            project.id,
      number:               nextNumber,
      period:               certPeriod,
      date:                 new Date().toISOString(),
      items:                certItems,
      totalBudgeted:        evmStats.BAC,
      totalCertified,
      previouslyCertified,
      thisPeriodAmount:     totalCertified - previouslyCertified,
      status:               'issued',
    };

    addProjectCertificate(cert);
    setPreviewCert(cert);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getStatusColor = (val: number, type: 'CPI' | 'SPI') => {
      if (val >= 1) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      if (val >= 0.85) return 'text-amber-600 bg-amber-50 border-amber-200';
      return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStatusText = (val: number, type: 'CPI' | 'SPI') => {
      if (type === 'CPI') {
          if (val > 1) return 'Bajo Presupuesto (Eficiente)';
          if (val === 1) return 'En Presupuesto';
          return 'Sobre Presupuesto (Costoso)';
      } else {
          if (val > 1) return 'Adelantado';
          if (val === 1) return 'A Tiempo';
          return 'Atrasado';
      }
  };

  // NEW: Interpretacion Semantica basada en PDF Page 10
  const getProjectSituation = () => {
      const { CPI, SPI } = evmStats;
      // Caso 1: Mayor Costo (CPI < 1), Mayor Avance (SPI > 1) -> Costoso pero Adelantado
      if (CPI < 1 && SPI > 1) return "Sobre Presupuesto y Adelantado";
      // Caso 2: Menor Costo (CPI > 1), Mayor Avance (SPI > 1) -> Eficiente y Adelantado (Ideal)
      if (CPI > 1 && SPI > 1) return "Bajo Presupuesto y Adelantado (Excelente)";
      // Caso 3: Mayor Costo (CPI < 1), Menor Avance (SPI < 1) -> Ineficiente y Atrasado (Critico)
      if (CPI < 1 && SPI < 1) return "Sobre Presupuesto y Atrasado (Crítico)";
      // Caso 4: Menor Costo (CPI > 1), Menor Avance (SPI < 1) -> Ahorro pero Lento
      if (CPI > 1 && SPI < 1) return "Bajo Presupuesto y Atrasado";
      
      return "En Línea con lo Planificado";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* CSS Injection for Print Media */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; size: auto; }
          body > *:not(#print-portal) { display: none !important; }
          #print-portal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
          #print-content { width: 100% !important; transform: none !important; box-shadow: none !important; border: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Control de Gestión (Valor Ganado)
            </h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-slate-500">Monitoreo de desvíos, curvas de inversión y análisis EVM.</p>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">{getProjectSituation()}</span>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
               <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Período</label>
               <input
                 type="month"
                 value={certPeriod}
                 onChange={e => setCertPeriod(e.target.value)}
                 className="p-1.5 border border-slate-200 rounded text-sm font-mono text-slate-700 focus:outline-none focus:border-blue-400"
               />
            </div>
            <button
               onClick={handleEmitCertificate}
               disabled={itemCosts.length === 0}
               className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold shadow-lg hover:bg-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
               <FileCheck size={18} /> Emitir Certificado
            </button>
         </div>
      </div>

      {/* EVM INDICATORS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CPI Card */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${getStatusColor(evmStats.CPI, 'CPI')}`}>
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold uppercase opacity-70">Desempeño Costo (CPI)</p>
                      <h3 className="text-3xl font-black mt-1">{evmStats.CPI.toFixed(2)}</h3>
                  </div>
                  <DollarSign size={24} className="opacity-50" />
              </div>
              <div className="mt-4 text-xs font-bold px-2 py-1 bg-white/50 rounded inline-block w-fit">
                  {getStatusText(evmStats.CPI, 'CPI')}
              </div>
          </div>

          {/* SPI Card */}
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${getStatusColor(evmStats.SPI, 'SPI')}`}>
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-xs font-bold uppercase opacity-70">Desempeño Cronograma (SPI)</p>
                      <h3 className="text-3xl font-black mt-1">{evmStats.SPI.toFixed(2)}</h3>
                  </div>
                  <Clock size={24} className="opacity-50" />
              </div>
              <div className="mt-4 text-xs font-bold px-2 py-1 bg-white/50 rounded inline-block w-fit">
                  {getStatusText(evmStats.SPI, 'SPI')}
              </div>
          </div>

          {/* Variances Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center gap-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Var. Costo (CV)</span>
                  <span className={`font-mono font-bold ${evmStats.CV >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {evmStats.CV >= 0 ? '+' : ''}${evmStats.CV.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </span>
              </div>
              <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Var. Cronograma (SV)</span>
                  <span className={`font-mono font-bold ${evmStats.SV >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {evmStats.SV >= 0 ? '+' : ''}${evmStats.SV.toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </span>
              </div>
          </div>

          {/* Projections Card */}
          <div className="bg-slate-800 text-white p-4 rounded-xl shadow-sm flex flex-col justify-center gap-2 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10"><Target size={100} /></div>
              <div className="relative z-10">
                  <p className="text-xs font-bold text-slate-400 uppercase">Estimado a Conclusión (EAC)</p>
                  <p className="text-2xl font-mono font-bold text-blue-300">${evmStats.EAC.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                  <div className="w-full h-px bg-slate-700 my-2"></div>
                  <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Presupuesto (BAC)</span>
                      <span className="font-mono text-slate-300">${evmStats.BAC.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <Activity size={20} className="text-blue-500" /> Curva S: Análisis EVM
                  </h3>
                  <div className="flex gap-4 text-xs font-bold">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-full"></div>Planificado (PV)</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div>Ganado (EV)</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Real (AC)</div>
                  </div>
              </div>
              
              <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={sCurveData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis 
                             fontSize={10} tickLine={false} axisLine={false} 
                             tickFormatter={(value) => `$${value/1000}k`} 
                          />
                          <Tooltip 
                             formatter={(value: number) => `$${value.toLocaleString()}`}
                             labelStyle={{ color: '#64748b', fontWeight: 'bold' }}
                             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          {/* PV Line (Area) */}
                          <Area type="monotone" dataKey="PV" stroke="#3b82f6" strokeWidth={2} fill="url(#colorPV)" fillOpacity={0.1} />
                          <defs>
                              <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          {/* EV Line (Solid Green) */}
                          <Line type="monotone" dataKey="EV" stroke="#10b981" strokeWidth={3} dot={{r:3}} activeDot={{r:6}} />
                          {/* AC Line (Solid Red) */}
                          <Line type="monotone" dataKey="AC" stroke="#ef4444" strokeWidth={3} dot={{r:3}} activeDot={{r:6}} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* Critical Deviations Table */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col">
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-500" /> Desvíos de Insumos (&gt;10%)
              </h3>
              <div className="flex-1 overflow-auto">
                 {deviations.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                         <FileCheck size={48} className="mb-2" />
                         <p className="text-sm">Sin desvíos críticos en materiales.</p>
                     </div>
                 ) : (
                     <table className="w-full text-left text-sm">
                         <thead className="bg-amber-50 text-amber-800 sticky top-0">
                             <tr>
                                 <th className="p-3 text-xs font-bold uppercase">Insumo</th>
                                 <th className="p-3 text-xs font-bold uppercase text-right">Var %</th>
                                 <th className="p-3 text-xs font-bold uppercase text-right">Dif $</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {deviations.map(dev => (
                                 <tr key={dev.id} className="hover:bg-slate-50">
                                     <td className="p-3">
                                         <div className="font-bold text-slate-700">{dev.name}</div>
                                         <div className="text-[10px] text-slate-400">Base: ${dev.basePrice} → Actual: ${dev.currentPrice}</div>
                                     </td>
                                     <td className="p-3 text-right font-bold text-red-600">
                                         +{dev.percent.toFixed(1)}%
                                     </td>
                                     <td className="p-3 text-right font-mono text-slate-600">
                                         ${(dev.currentPrice - dev.basePrice).toFixed(2)}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 )}
              </div>
          </div>
      </div>

      {/* --- ABC CURVE ANALYSIS (NEW) --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Layers size={20} className="text-purple-600" /> Análisis de Pareto (Curva ABC)
              </h3>
              <div className="flex gap-4">
                  <div className="bg-red-50 border border-red-100 px-3 py-1 rounded text-xs text-red-700 font-bold">
                      A: 80% Costo ({abcAnalysis.stats.A.count} ítems)
                  </div>
                  <div className="bg-blue-50 border border-blue-100 px-3 py-1 rounded text-xs text-blue-700 font-bold">
                      B: 15% Costo ({abcAnalysis.stats.B.count} ítems)
                  </div>
                  <div className="bg-green-50 border border-green-100 px-3 py-1 rounded text-xs text-green-700 font-bold">
                      C: 5% Costo ({abcAnalysis.stats.C.count} ítems)
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* ABC Chart */}
              <div className="lg:col-span-2 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={abcAnalysis.chartData} margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                              dataKey="name" 
                              fontSize={10} 
                              tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 10)}...` : val} 
                              interval={0}
                          />
                          <YAxis yAxisId="left" fontSize={10} tickFormatter={(v) => `$${v/1000}k`} />
                          <YAxis yAxisId="right" orientation="right" fontSize={10} unit="%" domain={[0, 100]} />
                          <Tooltip 
                              formatter={(value: any, name: string) => name === 'cumulativePercentage' ? `${Number(value).toFixed(1)}%` : `$${Number(value).toLocaleString()}`}
                              labelStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                          />
                          <Bar yAxisId="left" dataKey="cost" name="Costo Total" fill="#8884d8" barSize={20} radius={[4,4,0,0]} />
                          <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="% Acumulado" stroke="#ff7300" strokeWidth={2} dot={false} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>

              {/* ABC Table (Category A) */}
              <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                  <div className="bg-slate-50 p-2 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                      Ítems Críticos (Categoría A)
                  </div>
                  <div className="flex-1 overflow-auto max-h-60">
                      <table className="w-full text-left text-xs">
                          <thead className="bg-white text-slate-400 sticky top-0">
                              <tr>
                                  <th className="p-2">Ítem</th>
                                  <th className="p-2 text-right">Monto</th>
                                  <th className="p-2 text-right">%</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {abcAnalysis.items.filter(i => i.abcCategory === 'A').map((item: any) => (
                                  <tr key={item.id} className="hover:bg-slate-50">
                                      <td className="p-2 truncate max-w-[120px]" title={item.name}>{item.name}</td>
                                      <td className="p-2 text-right font-mono">${item.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                      <td className="p-2 text-right font-bold text-purple-600">{item.percentage.toFixed(1)}%</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </div>

      {/* --- TIME-COST TRADE OFF SIMULATOR (NEW FEATURE) --- */}
      <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Zap className="text-yellow-400" /> Simulador de Aceleración (Time-Cost Trade-off)
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">Análisis de impacto financiero al reducir la duración de una tarea (Crashing).</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <select 
                      className="bg-transparent text-white text-sm p-2 outline-none font-bold min-w-[200px]"
                      value={selectedTaskIdForCrash}
                      onChange={(e) => setSelectedTaskIdForCrash(e.target.value)}
                  >
                      <option value="">Seleccionar Tarea Crítica...</option>
                      {project.items.map(i => {
                          const t = tasks.find(tsk => tsk.id === i.taskId);
                          return <option key={i.taskId} value={i.taskId}>{t?.name}</option>;
                      })}
                  </select>
              </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Controls */}
              <div className="space-y-6">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                          <Users size={16} /> Recursos Adicionales
                      </label>
                      <input 
                          type="range" min="0" max="3" step="1" 
                          className="w-full accent-blue-500 mb-2"
                          value={crashScenario.addedCrews}
                          onChange={e => setCrashScenario({...crashScenario, addedCrews: parseInt(e.target.value)})}
                      />
                      <div className="flex justify-between text-xs text-slate-300 font-bold">
                          <span>Normal</span>
                          <span>+1 Cuadrilla</span>
                          <span>+2</span>
                          <span>+3 (Máx)</span>
                      </div>
                  </div>

                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                          <Clock size={16} /> Horas Extra / Turnos
                      </label>
                      <input 
                          type="range" min="0" max="100" step="50" 
                          className="w-full accent-yellow-500 mb-2"
                          value={crashScenario.overtimePercent}
                          onChange={e => setCrashScenario({...crashScenario, overtimePercent: parseInt(e.target.value)})}
                      />
                      <div className="flex justify-between text-xs text-slate-300 font-bold">
                          <span>0%</span>
                          <span>50%</span>
                          <span>100% (Doble Turno)</span>
                      </div>
                  </div>

                  {crashData && (
                      <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-800 text-blue-100 text-sm">
                          <div className="flex items-start gap-2">
                              <Info size={16} className="mt-0.5 flex-shrink-0" />
                              <p>
                                  La pendiente de costo actual es de <strong className="text-white">${crashData.costSlope.toFixed(0)}/día</strong>. 
                                  Acelerar más allá del punto de rotura puede generar retornos decrecientes por fatiga y saturación.
                              </p>
                          </div>
                      </div>
                  )}
              </div>

              {/* Visualization */}
              <div className="lg:col-span-2 flex flex-col">
                  {!crashData ? (
                      <div className="flex-1 flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl min-h-[300px]">
                          Seleccione una tarea para analizar su curva de tiempo-costo.
                      </div>
                  ) : (
                      <div className="flex flex-col h-full gap-4">
                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-4">
                              <div className="bg-slate-800 p-3 rounded-lg border-l-4 border-slate-500">
                                  <div className="text-xs text-slate-400 uppercase">Tiempo Ahorrado</div>
                                  <div className="text-2xl font-bold text-white flex items-center gap-2">
                                      {crashData.daysSaved} <span className="text-sm font-normal text-slate-500">días</span>
                                      {crashData.daysSaved > 0 && <FastForward size={16} className="text-emerald-400" />}
                                  </div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded-lg border-l-4 border-red-500">
                                  <div className="text-xs text-slate-400 uppercase">Costo Adicional</div>
                                  <div className="text-2xl font-bold text-white font-mono">
                                      +${crashData.costIncrease.toLocaleString()}
                                  </div>
                              </div>
                              <div className="bg-slate-800 p-3 rounded-lg border-l-4 border-blue-500">
                                  <div className="text-xs text-slate-400 uppercase">Nuevo Plazo</div>
                                  <div className="text-2xl font-bold text-white">
                                      {crashData.simDuration} <span className="text-sm font-normal text-slate-500">días</span>
                                  </div>
                              </div>
                          </div>

                          {/* Chart */}
                          <div className="flex-1 bg-white rounded-xl p-4 relative">
                              <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center">Curva Tiempo-Costo (Punto Normal vs Rotura)</h4>
                              <ResponsiveContainer width="100%" height={250}>
                                  <ComposedChart data={crashData.points}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis 
                                          dataKey="duration" 
                                          type="number" 
                                          domain={['dataMin - 1', 'dataMax + 1']} 
                                          label={{ value: 'Duración (Días)', position: 'insideBottom', offset: -5, fontSize: 10 }}
                                          reversed={true} // Time flows left to right usually, but reduction means going left
                                      />
                                      <YAxis 
                                          dataKey="cost" 
                                          domain={['auto', 'auto']} 
                                          tickFormatter={(v) => `$${v/1000}k`}
                                      />
                                      <Tooltip 
                                          formatter={(value: number) => `$${value.toLocaleString()}`}
                                          labelFormatter={(l) => `${l} días`}
                                      />
                                      {/* Curve */}
                                      <Line type="monotone" dataKey="cost" stroke="#94a3b8" strokeWidth={2} dot={{r: 4}} />
                                      
                                      {/* Highlight Current Point */}
                                      <ReferenceLine x={crashData.simDuration} stroke="#ef4444" strokeDasharray="3 3" label="Simulación" />
                                      <ReferenceLine y={crashData.simCost} stroke="#ef4444" strokeDasharray="3 3" />
                                  </ComposedChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* --- HISTORIAL DE CERTIFICADOS EMITIDOS --- */}
      {projectCertificates.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <FileCheck size={18} className="text-blue-600" /> Certificados Emitidos
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="pb-2 pr-4">N°</th>
                  <th className="pb-2 pr-4">Período</th>
                  <th className="pb-2 pr-4">Fecha Emisión</th>
                  <th className="pb-2 pr-4 text-right">Acumulado</th>
                  <th className="pb-2 pr-4 text-right">Este Período</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projectCertificates.map(cert => (
                  <tr key={cert.id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 font-bold text-slate-800">N° {cert.number}</td>
                    <td className="py-2 pr-4 font-mono text-slate-600">{cert.period}</td>
                    <td className="py-2 pr-4 text-slate-500">{new Date(cert.date).toLocaleDateString()}</td>
                    <td className="py-2 pr-4 text-right font-mono font-bold text-slate-800">
                      ${cert.totalCertified.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-emerald-700">
                      +${cert.thisPeriodAmount.toLocaleString()}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => setPreviewCert(cert)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <FileText size={13} /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CERTIFICATE PREVIEW MODAL --- */}
      {previewCert !== null && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
             {/* Toolbar */}
             <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
                <div className="flex items-center gap-4">
                   <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileCheck size={20} className="text-blue-600" /> Certificado de Obra</h3>
                   <div className="h-6 w-px bg-slate-200 mx-2"></div>
                   
                   <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                      <button onClick={() => setCertScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 hover:bg-white rounded shadow-sm text-slate-600"><ZoomOut size={16}/></button>
                      <span className="text-xs font-mono font-bold w-12 flex items-center justify-center text-slate-500">{Math.round(certScale * 100)}%</span>
                      <button onClick={() => setCertScale(s => Math.min(2, s + 0.1))} className="p-1.5 hover:bg-white rounded shadow-sm text-slate-600"><ZoomIn size={16}/></button>
                   </div>
                   
                   <button 
                     onClick={() => logoInputRef.current?.click()}
                     className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200"
                   >
                     <ImageIcon size={14} /> Logo
                   </button>
                   <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>

                <div className="flex items-center gap-4">
                    <button
                       onClick={handlePrintCertificate}
                       className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                    >
                       <Printer size={18} /> Imprimir Certificado
                    </button>
                    <button onClick={() => setPreviewCert(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={24}/></button>
                </div>
             </div>

             {/* Preview Area */}
             <div className="flex-1 overflow-auto bg-slate-500/10 p-8 flex justify-center items-start">
                <div
                   id="certificate-print-root"
                   className="bg-white shadow-2xl transition-transform origin-top duration-200"
                   style={{ 
                      width: '210mm', minHeight: '297mm', padding: '15mm',
                      transform: `scale(${certScale})`
                   }}
                >
                    <div ref={certificatePrintRef} id="print-content" className="font-sans text-slate-900 flex flex-col h-full">
                        
                        {/* Cert Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                           <div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Documento Oficial</div>
                              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Certificado de Obra N° {previewCert.number}</h1>
                              <div className="mt-2 text-sm font-medium">
                                Período: {new Date(previewCert.period + '-02').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                              </div>
                           </div>
                           {companyLogo ? (
                               <img src={companyLogo} alt="Logo" className="h-16 object-contain max-w-[200px]" />
                           ) : (
                               <div className="text-right">
                                  <div className="text-xl font-bold text-slate-800">{project.companyName || 'EMPRESA CONSTRUCTORA'}</div>
                                  <div className="text-xs text-slate-400">Gestión de Proyectos</div>
                               </div>
                           )}
                        </div>

                        {/* Project Details */}
                        <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm mb-8 bg-slate-50 p-6 rounded-lg border border-slate-100">
                             <div className="flex justify-between border-b border-slate-200 pb-1">
                                 <span className="text-slate-500 font-medium">Obra:</span>
                                 <span className="font-bold text-slate-900">{project.name}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-200 pb-1">
                                 <span className="text-slate-500 font-medium">Ubicación:</span>
                                 <span className="font-bold text-slate-900">{project.address}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-200 pb-1">
                                 <span className="text-slate-500 font-medium">Comitente:</span>
                                 <span className="font-bold text-slate-900">{project.client}</span>
                             </div>
                             <div className="flex justify-between border-b border-slate-200 pb-1">
                                 <span className="text-slate-500 font-medium">Fecha Emisión:</span>
                                 <span className="font-bold text-slate-900">{new Date(previewCert.date).toLocaleDateString()}</span>
                             </div>
                        </div>

                        {/* Certificate Table */}
                        <div className="flex-1">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-600 uppercase">
                                    <tr>
                                        <th className="p-2 border border-slate-300">Ítem</th>
                                        <th className="p-2 border border-slate-300">Unidad</th>
                                        <th className="p-2 border border-slate-300 text-right">Cant. Total</th>
                                        <th className="p-2 border border-slate-300 text-right">Precio Unit.</th>
                                        <th className="p-2 border border-slate-300 text-right">Monto Total</th>
                                        <th className="p-2 border border-slate-300 text-center">% Avance</th>
                                        <th className="p-2 border border-slate-300 text-right bg-slate-200 font-bold">A Certificar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(previewCert.items ?? []).map((row, i) => (
                                        <tr key={i} className="even:bg-slate-50">
                                            <td className="p-2 border border-slate-300 font-medium">{row.description}</td>
                                            <td className="p-2 border border-slate-300 text-center">{row.unit}</td>
                                            <td className="p-2 border border-slate-300 text-right">{row.quantity}</td>
                                            <td className="p-2 border border-slate-300 text-right">${(row.unitPrice ?? 0).toLocaleString()}</td>
                                            <td className="p-2 border border-slate-300 text-right">${(row.totalBudgeted ?? 0).toLocaleString()}</td>
                                            <td className="p-2 border border-slate-300 text-center">{row.progressPercent}%</td>
                                            <td className="p-2 border border-slate-300 text-right font-bold">${(row.amountCertified ?? 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 text-white font-bold">
                                        <td colSpan={6} className="p-3 text-right uppercase tracking-wide">Total Certificado Acumulado</td>
                                        <td className="p-3 text-right text-lg">${(previewCert.totalCertified ?? 0).toLocaleString()}</td>
                                    </tr>
                                    <tr className="bg-emerald-50 font-bold text-emerald-800">
                                        <td colSpan={6} className="p-2 text-right uppercase text-[10px]">Este Período</td>
                                        <td className="p-2 text-right">+${(previewCert.thisPeriodAmount ?? 0).toLocaleString()}</td>
                                    </tr>
                                    <tr className="bg-slate-100 font-bold text-slate-600">
                                        <td colSpan={6} className="p-2 text-right uppercase text-[10px]">Presupuesto Total (BAC)</td>
                                        <td className="p-2 text-right">${(previewCert.totalBudgeted ?? 0).toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Signatures */}
                        <div className="mt-20 grid grid-cols-3 gap-10 text-center break-inside-avoid">
                            <div className="border-t border-slate-400 pt-2">
                                <p className="font-bold text-slate-900 text-sm">Dirección de Obra</p>
                                <p className="text-[10px] text-slate-500 uppercase">Firma y Sello</p>
                            </div>
                            <div className="border-t border-slate-400 pt-2">
                                <p className="font-bold text-slate-900 text-sm">Empresa Constructora</p>
                                <p className="text-[10px] text-slate-500 uppercase">Representante Técnico</p>
                            </div>
                             <div className="border-t border-slate-400 pt-2">
                                <p className="font-bold text-slate-900 text-sm">Comitente</p>
                                <p className="text-[10px] text-slate-500 uppercase">Conformidad</p>
                            </div>
                        </div>

                    </div>
                </div>
             </div>
          </div>
      )}

    </div>
  );
};