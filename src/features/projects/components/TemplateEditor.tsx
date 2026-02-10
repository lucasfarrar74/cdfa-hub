import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useProjects } from '../context/ProjectsContext';
import type { ProcedureTemplate, ProcedurePhase, ProcedureTask, TaskCategory, ActivityCategory } from '../types';
import { getActivityCategory } from '../types';

const TASK_CATEGORIES: TaskCategory[] = [
  'administrative',
  'logistics',
  'communications',
  'budget',
  'participants',
  'materials',
  'compliance',
  'follow_up',
];

const PHASE_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-rose-500',
];

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  trade: 'Trade',
  educational: 'Educational',
  consultation: 'Consultation',
  other: 'Other',
};

export default function TemplateEditor() {
  const {
    procedureTemplates,
    addProcedureTemplate,
    updateProcedureTemplate,
    deleteProcedureTemplate,
    getAllActivityTypes,
    getActivityTypeInfo,
    customActivityTypes,
  } = useProjects();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return procedureTemplates.find((t) => t.id === selectedTemplateId) || null;
  }, [procedureTemplates, selectedTemplateId]);

  const allActivityTypes = useMemo(() => getAllActivityTypes(), [getAllActivityTypes]);

  // Group templates by activity category
  const groupedTemplates = useMemo(() => {
    const groups: Record<ActivityCategory, ProcedureTemplate[]> = {
      trade: [],
      educational: [],
      consultation: [],
      other: [],
    };
    for (const template of procedureTemplates) {
      const category = getActivityCategory(template.activityType, customActivityTypes);
      groups[category].push(template);
    }
    return groups;
  }, [procedureTemplates, customActivityTypes]);

  const handleNewTemplate = () => {
    const created = addProcedureTemplate({
      name: 'New Template',
      description: '',
      activityType: 'trade_show',
      version: '1.0',
      isActive: true,
      phases: [],
    });
    setSelectedTemplateId(created.id);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteProcedureTemplate(id);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(null);
    }
    setConfirmDeleteTemplateId(null);
  };

  // --- Phase helpers ---

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const updatePhase = (template: ProcedureTemplate, phaseId: string, updates: Partial<ProcedurePhase>) => {
    const updatedPhases = template.phases.map((p) =>
      p.id === phaseId ? { ...p, ...updates } : p
    );
    updateProcedureTemplate(template.id, { phases: updatedPhases });
  };

  const deletePhase = (template: ProcedureTemplate, phaseId: string) => {
    const updatedPhases = template.phases.filter((p) => p.id !== phaseId);
    updateProcedureTemplate(template.id, { phases: updatedPhases });
  };

  const addPhase = (template: ProcedureTemplate) => {
    const newPhase: ProcedurePhase = {
      id: uuidv4(),
      name: 'New Phase',
      description: '',
      order: template.phases.length + 1,
      startOffset: 0,
      endOffset: 0,
      tasks: [],
    };
    updateProcedureTemplate(template.id, { phases: [...template.phases, newPhase] });
    setExpandedPhases((prev) => new Set(prev).add(newPhase.id));
  };

  // --- Task helpers ---

  const updateTask = (template: ProcedureTemplate, phaseId: string, taskId: string, updates: Partial<ProcedureTask>) => {
    const updatedPhases = template.phases.map((phase) => {
      if (phase.id !== phaseId) return phase;
      return {
        ...phase,
        tasks: phase.tasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        ),
      };
    });
    updateProcedureTemplate(template.id, { phases: updatedPhases });
  };

  const deleteTask = (template: ProcedureTemplate, phaseId: string, taskId: string) => {
    const updatedPhases = template.phases.map((phase) => {
      if (phase.id !== phaseId) return phase;
      return {
        ...phase,
        tasks: phase.tasks.filter((t) => t.id !== taskId),
      };
    });
    updateProcedureTemplate(template.id, { phases: updatedPhases });
  };

  const addTask = (template: ProcedureTemplate, phaseId: string) => {
    const phase = template.phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const newTask: ProcedureTask = {
      id: uuidv4(),
      title: 'New Task',
      description: '',
      order: phase.tasks.length + 1,
      dueOffset: 0,
      reminderOffsets: [],
      isRequired: false,
      requiresApproval: false,
      dependsOnTaskIds: [],
      category: 'administrative',
    };
    const updatedPhases = template.phases.map((p) => {
      if (p.id !== phaseId) return p;
      return { ...p, tasks: [...p.tasks, newTask] };
    });
    updateProcedureTemplate(template.id, { phases: updatedPhases });
  };

  // --- Timeline Preview ---

  const renderTimeline = (template: ProcedureTemplate) => {
    if (template.phases.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Add phases to see the timeline preview.
        </p>
      );
    }

    const minOffset = Math.min(...template.phases.map((p) => p.startOffset));
    const maxOffset = Math.max(...template.phases.map((p) => p.endOffset));
    const range = maxOffset - minOffset;

    if (range <= 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Adjust phase start/end offsets to see the timeline.
        </p>
      );
    }

    const getPercent = (value: number) => ((value - minOffset) / range) * 100;

    return (
      <div className="space-y-2">
        <div className="relative h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
          {template.phases.map((phase, idx) => {
            const left = getPercent(phase.startOffset);
            const width = getPercent(phase.endOffset) - left;
            const colorClass = PHASE_COLORS[idx % PHASE_COLORS.length];
            return (
              <div
                key={phase.id}
                className={`absolute top-2 h-6 rounded ${colorClass} opacity-80`}
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                title={`${phase.name}: Day ${phase.startOffset} to Day ${phase.endOffset}`}
              >
                {/* Task dots */}
                {phase.tasks.map((task) => {
                  const taskPercent = range > 0 ? ((task.dueOffset - phase.startOffset) / (phase.endOffset - phase.startOffset)) * 100 : 50;
                  return (
                    <div
                      key={task.id}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full border border-gray-400"
                      style={{ left: `${Math.min(Math.max(taskPercent, 2), 98)}%` }}
                      title={`${task.title}: Day ${task.dueOffset}`}
                    />
                  );
                })}
              </div>
            );
          })}
          {/* Day 0 marker */}
          {minOffset <= 0 && maxOffset >= 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500"
              style={{ left: `${getPercent(0)}%` }}
            />
          )}
        </div>
        {/* Phase labels */}
        <div className="relative h-6">
          {template.phases.map((phase, idx) => {
            const left = getPercent(phase.startOffset);
            const width = getPercent(phase.endOffset) - left;
            return (
              <div
                key={phase.id}
                className="absolute text-xs truncate text-gray-600 dark:text-gray-400"
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                title={phase.name}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${PHASE_COLORS[idx % PHASE_COLORS.length]}`} />
                {phase.name}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          Day 0 = Activity Start
        </p>
      </div>
    );
  };

  // --- Render helper: total task count ---
  const getTotalTaskCount = (template: ProcedureTemplate) =>
    template.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);

  return (
    <div className="h-full flex">
      {/* Template list (left panel) */}
      <div
        className={`flex flex-col border-r border-gray-200 dark:border-gray-700 ${
          selectedTemplateId ? 'hidden lg:flex lg:w-2/5' : 'w-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Procedure Templates
          </h2>
          <button
            onClick={handleNewTemplate}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Template
          </button>
        </div>

        {/* Template cards grouped by category */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((category) => {
            const templates = groupedTemplates[category];
            if (templates.length === 0) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {CATEGORY_LABELS[category]}
                </h3>
                <div className="space-y-2">
                  {templates.map((template) => {
                    const typeInfo = getActivityTypeInfo(template.activityType);
                    const totalTasks = getTotalTaskCount(template);
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                          isSelected ? 'border-l-4 border-l-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {template.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {typeInfo.name}
                            </p>
                          </div>
                          <span
                            className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                              template.isActive
                                ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {template.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                          <span>{template.phases.length} phase{template.phases.length !== 1 ? 's' : ''}</span>
                          <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {procedureTemplates.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No templates yet.</p>
              <p className="text-sm mt-1">Click "New Template" to create one.</p>
            </div>
          )}
        </div>
      </div>

      {/* Template editor (right panel) */}
      {selectedTemplate ? (
        <div className="flex-1 lg:w-3/5 overflow-auto bg-gray-50 dark:bg-gray-900">
          {/* Back button (mobile) */}
          <div className="lg:hidden p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              onClick={() => setSelectedTemplateId(null)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              &larr; Back to list
            </button>
          </div>

          <div className="p-4 space-y-6">
            {/* Header section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={selectedTemplate.name}
                      onChange={(e) => updateProcedureTemplate(selectedTemplate.id, { name: e.target.value })}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Activity Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Activity Type
                    </label>
                    <select
                      value={selectedTemplate.activityType}
                      onChange={(e) => updateProcedureTemplate(selectedTemplate.id, { activityType: e.target.value })}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    >
                      {allActivityTypes.map((at) => (
                        <option key={at.id} value={at.id}>
                          {at.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={selectedTemplate.description}
                      onChange={(e) => updateProcedureTemplate(selectedTemplate.id, { description: e.target.value })}
                      rows={3}
                      className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Active toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.isActive}
                      onChange={(e) => updateProcedureTemplate(selectedTemplate.id, { isActive: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                  </label>
                </div>

                {/* Delete template */}
                <div>
                  {confirmDeleteTemplateId === selectedTemplate.id ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-red-600 dark:text-red-400">Delete this template?</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleDeleteTemplate(selectedTemplate.id)}
                          className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTemplateId(null)}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 text-xs rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteTemplateId(selectedTemplate.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete template"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Phases section */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Phases</h3>
              <div className="space-y-3">
                {selectedTemplate.phases.map((phase, phaseIdx) => {
                  const isPhaseExpanded = expandedPhases.has(phase.id);
                  return (
                    <div
                      key={phase.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                    >
                      {/* Phase header */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer"
                        onClick={() => togglePhaseExpanded(phase.id)}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${PHASE_COLORS[phaseIdx % PHASE_COLORS.length]}`}>
                          {phase.order}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {phase.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Day {phase.startOffset} to Day {phase.endOffset}
                            {phase.description && ` -- ${phase.description}`}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {phase.tasks.length} task{phase.tasks.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePhase(selectedTemplate, phase.id);
                          }}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Delete phase"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg
                          className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${isPhaseExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Phase body */}
                      {isPhaseExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                          {/* Phase fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Phase Name
                              </label>
                              <input
                                type="text"
                                value={phase.name}
                                onChange={(e) => updatePhase(selectedTemplate, phase.id, { name: e.target.value })}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description
                              </label>
                              <input
                                type="text"
                                value={phase.description}
                                onChange={(e) => updatePhase(selectedTemplate, phase.id, { description: e.target.value })}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Start (days from activity start)
                              </label>
                              <input
                                type="number"
                                value={phase.startOffset}
                                onChange={(e) => updatePhase(selectedTemplate, phase.id, { startOffset: Number(e.target.value) })}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                End (days from activity start)
                              </label>
                              <input
                                type="number"
                                value={phase.endOffset}
                                onChange={(e) => updatePhase(selectedTemplate, phase.id, { endOffset: Number(e.target.value) })}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              />
                            </div>
                          </div>

                          {/* Tasks */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Tasks</h4>
                            <div className="space-y-2">
                              {phase.tasks.map((task) => {
                                const isTaskExpanded = expandedTasks.has(task.id);
                                return (
                                  <div
                                    key={task.id}
                                    className="border border-gray-200 dark:border-gray-600 rounded-lg"
                                  >
                                    {/* Task row */}
                                    <div className="flex items-center gap-2 p-2">
                                      <input
                                        type="text"
                                        value={task.title}
                                        onChange={(e) => updateTask(selectedTemplate, phase.id, task.id, { title: e.target.value })}
                                        className="flex-1 min-w-0 border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        placeholder="Task title"
                                      />
                                      <input
                                        type="number"
                                        value={task.dueOffset}
                                        onChange={(e) => updateTask(selectedTemplate, phase.id, task.id, { dueOffset: Number(e.target.value) })}
                                        className="w-20 border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                        title="Due offset (days)"
                                      />
                                      <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer" title="Required">
                                        <input
                                          type="checkbox"
                                          checked={task.isRequired}
                                          onChange={(e) => updateTask(selectedTemplate, phase.id, task.id, { isRequired: e.target.checked })}
                                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                        />
                                        <span className="text-xs text-gray-600 dark:text-gray-400">Req</span>
                                      </label>
                                      <select
                                        value={task.category}
                                        onChange={(e) => updateTask(selectedTemplate, phase.id, task.id, { category: e.target.value as TaskCategory })}
                                        className="w-32 border dark:border-gray-600 rounded px-2 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                      >
                                        {TASK_CATEGORIES.map((cat) => (
                                          <option key={cat} value={cat}>
                                            {cat.replace('_', ' ')}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => toggleTaskExpanded(task.id)}
                                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                        title="Expand details"
                                      >
                                        <svg
                                          className={`w-4 h-4 transition-transform ${isTaskExpanded ? 'rotate-180' : ''}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => deleteTask(selectedTemplate, phase.id, task.id)}
                                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                        title="Delete task"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>

                                    {/* Task expanded details */}
                                    {isTaskExpanded && (
                                      <div className="border-t border-gray-200 dark:border-gray-600 p-3 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Description
                                          </label>
                                          <textarea
                                            value={task.description}
                                            onChange={(e) => updateTask(selectedTemplate, phase.id, task.id, { description: e.target.value })}
                                            rows={2}
                                            className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                          />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                              Estimated Hours
                                            </label>
                                            <input
                                              type="number"
                                              value={task.estimatedHours ?? ''}
                                              onChange={(e) =>
                                                updateTask(selectedTemplate, phase.id, task.id, {
                                                  estimatedHours: e.target.value ? Number(e.target.value) : undefined,
                                                })
                                              }
                                              className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                              min={0}
                                              step={0.5}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                              Approver Role
                                            </label>
                                            <input
                                              type="text"
                                              value={task.approverRole ?? ''}
                                              onChange={(e) =>
                                                updateTask(selectedTemplate, phase.id, task.id, {
                                                  approverRole: e.target.value || undefined,
                                                })
                                              }
                                              className="w-full border dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                                              placeholder="e.g. Manager"
                                            />
                                          </div>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={task.requiresApproval}
                                            onChange={(e) =>
                                              updateTask(selectedTemplate, phase.id, task.id, { requiresApproval: e.target.checked })
                                            }
                                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                                          />
                                          <span className="text-sm text-gray-700 dark:text-gray-300">Requires approval</span>
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => addTask(selectedTemplate, phase.id)}
                              className="mt-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            >
                              + Add Task
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Phase button */}
              <button
                onClick={() => addPhase(selectedTemplate)}
                className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                + Add Phase
              </button>
            </div>

            {/* Timeline Preview */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Timeline Preview</h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                {renderTimeline(selectedTemplate)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">Select a template</p>
            <p className="text-sm mt-1">Choose a template from the list or create a new one.</p>
          </div>
        </div>
      )}
    </div>
  );
}
