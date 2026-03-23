# Arquitectura de Gestión de Obras

Este documento describe la arquitectura actual de la aplicación de Gestión de Obras, sus flujos de estado, entidades principales, módulos, riesgos técnicos y un plan de desarrollo incremental sugerido.

## 1. Flujo del Estado

La aplicación utiliza una combinación de React Context API y hooks personalizados para la gestión del estado global y la persistencia local.

### **ERPContext** (Provider: `ERPProvider` en `context/ERPContext.tsx`)
Es el corazón de la aplicación ("God Object").
*   **Propósito**: Centraliza **todo** el estado de la aplicación: configuración global, bases de datos maestras (materiales, tareas), y datos transaccionales del proyecto activo.
*   **Lectura**: Módulos como `Planning.tsx` (Gantt), `APUBuilder.tsx` (Detalle de Tarea), y `TaskRelations.tsx` consumen datos usando el hook `useERP()`.
*   **Mutación**: Expone funciones (ej. `updateTaskMaster`, `addDependency`, `addBudgetItem`) que actualizan el estado en memoria.
*   **Persistencia**: Utiliza múltiples instancias del hook `usePersistentState` para sincronizar cada "tabla" (array de objetos) con `localStorage`.

### **AuthContext** (Provider: `AuthProvider` en `context/AuthContext.tsx`)
*   **Propósito**: Gestiona la sesión del usuario.
*   **Estado Actual**: Implementación **Mock**. No conecta con ningún backend real. Simula roles ('admin', 'project_manager', 'worker') y guarda la sesión en `localStorage` ('erp_user_session').

### **usePersistentState** (Hook en `hooks/usePersistentState.ts`)
*   **Mecanismo**: `useState` inicializado con lectura perezosa de `localStorage`.
*   **Sincronización**: `useEffect` escucha cambios en el estado y escribe en `localStorage`.
*   **Limitaciones**: Maneja errores de cuota (`QuotaExceededError`), pero es síncrono y limitado al navegador del cliente.

## 2. Entidades Principales

Definidas en `types.ts` y gestionadas como colecciones en `ERPContext`.

### Núcleo del Proyecto
*   **`Project`**: Entidad raíz. Contiene configuración (`workdayHours`, `pricing`), listas de items (`items`), y dependencias (`dependencies`).
*   **`BudgetItem`**: Instancia de una tarea dentro de un proyecto. Vincula a una `Task` maestra pero tiene sus propios datos de ejecución (`startDate`, `endDate`, `quantity`, `progress`).
*   **`Task` (Maestra)**: Definición estándar de una actividad (ej. "Muro de Ladrillo"). Contiene rendimientos teóricos y costos base.
*   **`ProjectDependency`**: Relación lógica entre dos `BudgetItem` (`fromTaskId` -> `toTaskId`) con tipo (FS, SS, FF, SF) y lag.

### Recursos y Costos (APU)
*   **`Material`**: Insumos básicos (Cemento, Arena).
*   **`Tool`**: Equipos y herramientas (Retroexcavadora).
*   **`LaborCategory`**: Categorías de mano de obra (Oficial, Ayudante).
*   **`Crew`**: Cuadrillas predefinidas (composición de categorías laborales).
*   **`TaskYield` / `TaskToolYield` / `TaskCrewYield`**: Tablas intermedias que definen el consumo de recursos por unidad de tarea.

### Módulos Satélite
*   **`Reception`**: Remitos y control de stock de materiales.
*   **`Subcontractor` / `Contract` / `Certification`**: Gestión de terceros y pagos.
*   **`ProjectDocument`**: Gestión documental básica.
*   **`MeasurementSheet`**: Cómputos métricos detallados vinculados a items del presupuesto.
*   **`QualityProtocol` / `QualityInspection`**: Control de calidad en obra.

## 3. Módulos y Pantallas Principales

*   **`Planning.tsx` (Gantt / Planificación)**
    *   **Rol**: Motor de programación.
    *   **Lógica**: Ejecuta algoritmos de ruta crítica (Forward Pass) en el frontend para calcular fechas de inicio y fin basadas en dependencias y calendario laboral.
    *   **Interacción**: Permite visualizar el cronograma y abrir el `APUBuilder` para editar detalles.

*   **`APUBuilder.tsx` (Constructor de APU)**
    *   **Rol**: Editor de detalle de tarea.
    *   **Lógica**: Permite componer el análisis de precio unitario (materiales, mano de obra) y gestionar relaciones (`TaskRelations`).
    *   **Conexión**: Recibe `budgetItemId` para editar una instancia específica o `taskId` para editar la maestra.

*   **`BudgetEditor.tsx` / `BudgetGrid.tsx`**
    *   **Rol**: Vista de presupuesto económico.
    *   **Lógica**: Enfocada en costos, precios unitarios y totales.

*   **`App.tsx` (Enrutador)**
    *   **Rol**: "Router" manual basado en estado `activeTab`.
    *   **Seguridad**: Implementa `ProtectedRoute` para restringir acceso a módulos según el rol del usuario mockeado.

## 4. Riesgos Técnicos Actuales

1.  **"God Context" (ERPContext)**:
    *   El archivo `ERPContext.tsx` es monolítico. Cualquier cambio de estado provoca re-renderizados en toda la aplicación.
    *   Mezcla lógica de negocio (cálculos de costos), persistencia y estado de UI.

2.  **Persistencia en LocalStorage**:
    *   **Fragilidad**: Los datos viven en el navegador del usuario. Si borra caché o cambia de dispositivo, se pierden los datos.
    *   **Escalabilidad**: `localStorage` tiene un límite (aprox 5MB). Un proyecto grande con muchas tareas y dependencias podría excederlo.
    *   **Concurrencia**: Imposible soportar múltiples usuarios editando el mismo proyecto.

3.  **Seguridad Nula**:
    *   La autenticación es simulada. No hay tokens, ni validación de sesión real.
    *   Toda la lógica de permisos está en el cliente y es fácilmente bypassable.

4.  **Performance del Gantt**:
    *   El cálculo de fechas (`scheduledItems` en `Planning.tsx`) se ejecuta en el cliente. Para cronogramas grandes (>500 tareas), esto bloqueará el hilo principal de JS.

## 5. Plan Incremental Sugerido

### Etapa A: Consolidación Local (Refactoring & UX)
*   **Objetivo**: Mejorar la mantenibilidad y usabilidad antes de migrar al backend.
*   **Acciones**:
    1.  **Dividir ERPContext**: Separar en contextos más pequeños: `ProjectContext` (datos del proyecto activo), `MasterDataContext` (materiales, tareas globales), `UIContext`.
    2.  **Optimizar Planning**: Implementar `useMemo` agresivo y virtualización para el renderizado de filas en el Gantt.
    3.  **Validación de Datos**: Implementar Zod o similar para validar la integridad de los datos al importar/exportar o guardar en localStorage.

### Etapa B: Autenticación Real (Supabase Auth)
*   **Objetivo**: Identidad de usuarios real.
*   **Acciones**:
    1.  Configurar proyecto en Supabase.
    2.  Reemplazar `AuthContext` mock con cliente de Supabase Auth (`onAuthStateChange`).
    3.  Mantener los datos en `localStorage` temporalmente, pero vinculados al UUID del usuario autenticado.

### Etapa C: Persistencia en la Nube (Supabase DB)
*   **Objetivo**: Fuente de verdad centralizada y seguridad.
*   **Acciones**:
    1.  **Diseño de Esquema**: Replicar las interfaces de `types.ts` en tablas PostgreSQL (`projects`, `tasks`, `budget_items`, `dependencies`, etc.).
    2.  **Migración de Hooks**: Crear un servicio de API que reemplace `usePersistentState`. En lugar de escribir en localStorage, escribir en Supabase.
    3.  **Row Level Security (RLS)**: Configurar políticas para que los usuarios solo vean los proyectos de su `organizationId`.

### Etapa D: Funcionalidades Avanzadas
*   **Objetivo**: Colaboración y escala.
*   **Acciones**:
    1.  **Multi-usuario**: Habilitar WebSockets (Supabase Realtime) para ver cambios de otros usuarios en el Gantt en tiempo real.
    2.  **Backend Functions**: Mover el cálculo de la ruta crítica (scheduling) a Edge Functions para quitar carga del cliente.
    3.  **Gestión de Archivos**: Usar Supabase Storage para los documentos y fotos de recepciones.
