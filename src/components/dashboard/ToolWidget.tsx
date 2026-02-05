import { useState } from 'react';
import { IframeContainer } from '../iframe/IframeContainer';
import { FullScreenModal } from '../iframe/FullScreenModal';
import type { Tool, WidgetConfig } from '../../types';
import { cn } from '../../lib/utils';

interface ToolWidgetProps {
  tool: Tool;
  config: WidgetConfig;
}

export function ToolWidget({ tool, config }: ToolWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div
        className={cn(
          config.gridSpan === 'full' ? 'col-span-full' : 'col-span-1'
        )}
      >
        <IframeContainer
          src={tool.dashboardUrl}
          title={config.title}
          minHeight={config.minHeight}
          onExpand={() => setIsExpanded(true)}
        />
      </div>

      <FullScreenModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        src={tool.dashboardUrl}
        title={config.title}
      />
    </>
  );
}
