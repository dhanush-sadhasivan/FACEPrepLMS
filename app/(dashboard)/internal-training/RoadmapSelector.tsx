'use client';

interface RoadmapOption {
  id: string;
  title: string;
  domain?: string;
}

interface RoadmapSelectorProps {
  roadmaps: RoadmapOption[];
  selectedId: string;
  onSelectRoadmap: (id: string) => void;
}

export default function RoadmapSelector({
  roadmaps,
  selectedId,
  onSelectRoadmap,
}: RoadmapSelectorProps) {
  if (!roadmaps || roadmaps.length <= 1) return null;

  return (
    <div className="it-roadmap-selector-bar">
      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '0.35rem' }}>
        Assigned IT Roadmaps:
      </span>
      {roadmaps.map((rm) => {
        const isActive = rm.id === selectedId;
        return (
          <button
            key={rm.id}
            type="button"
            className={`it-roadmap-tab ${isActive ? 'active' : ''}`}
            onClick={() => onSelectRoadmap(rm.id)}
          >
            <span>🗺️</span>
            <span>{rm.title}</span>
          </button>
        );
      })}
    </div>
  );
}
