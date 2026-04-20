'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Activity,
  Zap,
  Globe,
  Server,
  Router,
  GripVertical,
  ChevronRight,
  Save,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Info,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

type ProviderId = 'mac_local' | 'groq' | 'openrouter' | 'local' | 'pico_router';

interface ProviderMeta {
  id: ProviderId;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  type: 'local' | 'cloud';
  color: string;
  usedIn: ('summarization' | 'translation')[];
  disabled?: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'pico_router',
    name: 'PicoClaw Router',
    subtitle: 'LXC on LAN — proxies to Mac LlamaCPP via local network',
    icon: <Router className="w-4 h-4" />,
    type: 'local',
    color: 'teal',
    usedIn: ['summarization', 'translation'],
  },
  {
    id: 'mac_local',
    name: 'PicoClaw Mac',
    subtitle: 'Local Mac Inference (llama.cpp)',
    icon: <Activity className="w-4 h-4" />,
    type: 'local',
    color: 'emerald',
    usedIn: ['summarization', 'translation'],
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    subtitle: 'Fast Llama 3 Inference',
    icon: <Zap className="w-4 h-4" />,
    type: 'cloud',
    color: 'blue',
    usedIn: ['summarization', 'translation'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    subtitle: 'Cloud — backup/paid fallback',
    icon: <Globe className="w-4 h-4" />,
    type: 'cloud',
    color: 'violet',
    usedIn: ['summarization', 'translation'],
  },
  {
    id: 'local',
    name: 'VPS Local (Qwen)',
    subtitle: 'Container-based fallback',
    icon: <Server className="w-4 h-4" />,
    type: 'local',
    color: 'orange',
    usedIn: ['summarization', 'translation'],
  },
];

const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p])) as Record<ProviderId, ProviderMeta>;

const colorClasses = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-500', dot: 'bg-emerald-500' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-500', dot: 'bg-blue-500' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-500', dot: 'bg-violet-500' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-500', dot: 'bg-orange-500' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/30', text: 'text-teal-500', dot: 'bg-teal-500' },
};

interface ProviderHealth {
  status: string;
  latency?: number;
}

interface SortableNodeProps {
  id: ProviderId;
  index: number;
  health?: ProviderHealth;
  isLast: boolean;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'healthy') return <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />;
  if (status === 'disabled') return <Clock className="w-3 h-3 text-yellow-500 shrink-0" />;
  return <XCircle className="w-3 h-3 text-red-500 shrink-0" />;
}

function SortableNode({ id, index, health, isLast }: SortableNodeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const meta = PROVIDER_MAP[id];
  const colors = colorClasses[meta?.color as keyof typeof colorClasses] || colorClasses.blue;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'relative flex flex-col gap-2 p-3 rounded-xl border w-44 shrink-0 select-none',
          'transition-shadow bg-card',
          colors.border,
          isDragging ? 'shadow-2xl shadow-primary/20 opacity-90 scale-[1.02]' : 'shadow-sm hover:shadow-md',
        )}
      >
        {/* Priority badge */}
        <div className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-background border border-border/50 flex items-center justify-center">
          <span className="text-[9px] font-black text-muted-foreground">{index + 1}</span>
        </div>

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Icon + type */}
        <div className="flex items-center gap-2 pr-5">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', colors.bg, colors.text)}>
            {meta?.icon}
          </div>
          <span className={cn('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full',
            meta?.type === 'local' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          )}>
            {meta?.type}
          </span>
        </div>

        {/* Name */}
        <div>
          <p className="text-xs font-bold leading-tight">{meta?.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{meta?.subtitle}</p>
        </div>

        {/* Health */}
        {health && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
            <StatusIcon status={health.status} />
            <span className="text-[9px] text-muted-foreground capitalize">{health.status}</span>
            {health.latency && (
              <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">{health.latency}ms</span>
            )}
          </div>
        )}
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
      )}
    </div>
  );
}

interface PipelineEditorProps {
  label: string;
  description: string;
  items: ProviderId[];
  onChange: (items: ProviderId[]) => void;
  availableProviders: ProviderId[];
  providerHealth: Record<string, ProviderHealth>;
}

function PipelineEditor({ label, description, items, onChange, availableProviders, providerHealth }: PipelineEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as ProviderId);
      const newIndex = items.indexOf(over.id as ProviderId);
      onChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  // Providers not yet in pipeline (can be added)
  const notInPipeline = availableProviders.filter(p => !items.includes(p));

  const addProvider = (id: ProviderId) => onChange([...items, id]);
  const removeProvider = (id: ProviderId) => onChange(items.filter(p => p !== id));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>

      {/* Pipeline flow */}
      <div className="p-4 rounded-xl border border-border/30 bg-card/20 overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={horizontalListSortingStrategy}>
            <div className="flex items-center gap-2 min-w-max">
              {items.map((id, idx) => (
                <div key={id} className="relative group">
                  <SortableNode
                    id={id}
                    index={idx}
                    health={providerHealth[id]}
                    isLast={idx === items.length - 1}
                  />
                  {/* Remove button */}
                  <button
                    onClick={() => removeProvider(id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black leading-none z-10 hover:bg-red-600"
                    title="Remove from pipeline"
                  >
                    ×
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-8">No providers in pipeline — add one below</p>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Add providers */}
      {notInPipeline.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add:</span>
          {notInPipeline.map(id => {
            const meta = PROVIDER_MAP[id];
            return (
              <button
                key={id}
                onClick={() => addProvider(id)}
                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors"
              >
                + {meta?.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

export default function PipelinePage() {
  const { data, isLoading, mutate: revalidate } = useSWR(
    `${API_BASE}/api/admin/ai/pipeline`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const [summarization, setSummarization] = useState<ProviderId[]>([]);
  const [translation, setTranslation] = useState<ProviderId[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setSummarization(data.summarization || ['mac_local', 'groq', 'openrouter', 'local']);
      setTranslation(data.translation || ['mac_local', 'groq', 'openrouter', 'local']);
    }
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/admin/ai/pipeline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ summarization, translation }),
      });
      setSaved(true);
      revalidate();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const providerHealth: Record<string, ProviderHealth> = data?.providerHealth || {};

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 h-8 flex items-center justify-between px-4 border-b border-border/40 bg-card/30">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold">AI Pipeline</span>
          <span className="text-[9px] font-mono border px-1.5 py-0.5 rounded text-muted-foreground border-border/40">
            drag to reorder priority
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => revalidate()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-6 px-3 text-[11px] gap-1.5"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? 'Saved!' : 'Save Pipelines'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-8">
        {/* Info banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-bold mb-0.5">How it works</p>
            <p className="text-[11px] opacity-80">Providers are tried in order — left to right. If the first provider is unavailable or rate-limited, the next one takes over automatically. Drag cards to change priority. Mac M1 first = free local inference when available, cloud only as fallback.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Summarization Pipeline */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Signal Summarization</span>
              </div>
              <PipelineEditor
                label="Summarization Pipeline"
                description="Used when processing incoming RSS signals. Providers are tried in this order until one succeeds."
                items={summarization}
                onChange={setSummarization}
                availableProviders={PROVIDERS.filter(p => p.usedIn.includes('summarization')).map(p => p.id)}
                providerHealth={providerHealth}
              />
            </div>

            <div className="border-t border-border/20" />

            {/* Translation Pipeline */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Translation</span>
              </div>
              <PipelineEditor
                label="Translation Pipeline"
                description="Used when serving the localized feed (Bengali, Spanish, etc.). Local AI Router acts as the primary intelligent proxy."
                items={translation}
                onChange={setTranslation}
                availableProviders={PROVIDERS.filter(p => p.usedIn.includes('translation')).map(p => p.id)}
                providerHealth={providerHealth}
              />
            </div>

            {/* Provider Legend */}
            <div className="pt-4 border-t border-border/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Provider Reference</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PROVIDERS.map(p => {
                  const health = providerHealth[p.id];
                  const colors = colorClasses[p.color as keyof typeof colorClasses];
                  return (
                    <div key={p.id} className={cn('flex items-center gap-3 p-3 rounded-lg border border-border/20 bg-card/20', p.disabled && 'opacity-40')}>
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', colors?.bg, colors?.text)}>
                        {p.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          {p.disabled ? <span className="text-[9px] font-mono text-muted-foreground/60 uppercase">disabled</span> : health && <StatusIcon status={health.status} />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{p.subtitle}</p>
                        {!p.disabled && health?.latency && (
                          <p className="text-[9px] font-mono text-muted-foreground/60">{health.latency}ms</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
