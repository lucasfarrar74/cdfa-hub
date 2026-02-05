import { ToolWidget } from './ToolWidget';
import { dashboardWidgets } from '../../config/navigation';
import { tools } from '../../config/tools';

export function DashboardGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {dashboardWidgets.map((widget) => {
        const tool = tools.find(t => t.id === widget.toolId);
        if (!tool) return null;

        return (
          <ToolWidget
            key={widget.id}
            tool={tool}
            config={widget}
          />
        );
      })}
    </div>
  );
}
