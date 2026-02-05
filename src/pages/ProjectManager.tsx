import { IframeContainer } from '../components/iframe/IframeContainer';
import { getToolById } from '../config/tools';

export function ProjectManager() {
  const tool = getToolById('project-manager');

  if (!tool) {
    return <div>Tool not found</div>;
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      <IframeContainer
        src={tool.url}
        title={tool.name}
        minHeight={0}
        className="h-full"
      />
    </div>
  );
}
