"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Globe } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const API_BASE = "/api/signals";
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface GeoData {
  country: string;
  count: number;
}

export function GeoHeatmap() {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  const { data, isLoading } = useSWR<GeoData[]>(
    `${API_BASE}/geo`,
    fetcher,
    { refreshInterval: 300000 }
  );

  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, 50, 100, 200])
      .range(["#ede9fe", "#c4b5fd", "#a78bfa", "#7c3aed"]);
  }, []);

  const countryData = useMemo(() => {
    if (!data) return {};
    return data.reduce(
      (acc: Record<string, number>, item) => {
        acc[item.country] = item.count;
        return acc;
      },
      {}
    );
  }, [data]);

  const totalSignals = data?.reduce((sum, d) => sum + d.count, 0) || 0;

  const handleMouseEnter = (geo: any, event: MouseEvent) => {
    const countryName = geo.properties.name;
    const countryCode = (geo.properties as any).iso_a2 || geo.id;
    const count = countryData[countryCode] || 0;
    
    setTooltip({
      name: countryName,
      count,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleClick = (geo: any) => {
    const countryCode = (geo.properties as any).iso_a2 || geo.id;
    router.push(`/?country=${countryCode}`);
  };

  if (isLoading) {
    return (
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold">Geographic Distribution</h3>
        </div>
        <div className="h-[300px] bg-muted/50 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold">Geographic Distribution</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalSignals.toLocaleString()} signals (30d)
        </span>
      </div>

      <div className="relative">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 100 }}
          style={{ width: "100%", height: "280px" }}
        >
          <ZoomableGroup center={[0, 20]}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryCode = (geo.properties as any).iso_a2 || geo.id;
                  const count = countryData[countryCode] || 0;
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(event) => handleMouseEnter(geo, event as unknown as MouseEvent)}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => handleClick(geo)}
                      style={{
                        default: {
                          fill: count > 0 ? colorScale(count) : "#e2e8f0",
                          stroke: "#fff",
                          strokeWidth: 0.5,
                          outline: "none",
                        },
                        hover: {
                          fill: "#7c3aed",
                          stroke: "#fff",
                          strokeWidth: 1,
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: {
                          fill: "#6d28d9",
                          stroke: "#fff",
                          strokeWidth: 1,
                          outline: "none",
                        },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {tooltip && tooltip.count > 0 && (
          <div
            className="absolute z-50 bg-card border border-border rounded-lg shadow-lg p-2 text-sm pointer-events-none"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 150),
              top: tooltip.y - 60,
            }}
          >
            <p className="font-medium">{tooltip.name}</p>
            <p className="text-muted-foreground">
              {tooltip.count.toLocaleString()} signals
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: "#ede9fe" }} />
          <span>&lt;50</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: "#c4b5fd" }} />
          <span>50-100</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: "#a78bfa" }} />
          <span>100-200</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: "#7c3aed" }} />
          <span>&gt;200</span>
        </div>
      </div>
    </div>
  );
}