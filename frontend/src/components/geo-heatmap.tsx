"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Globe } from "lucide-react";

const GEO_URL = "https://raw.githubusercontent.com/zcreativelabs/react-simple-maps/master/topojson-maps/world-110m.json";

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
      .domain([0, 20, 100, 500])
      .range(["#8b5cf6", "#7c3aed", "#6d28d9", "#4c1d95"]);
  }, []);

  const countryData = useMemo(() => {
    if (!data) return {};
    return data.reduce(
      (acc: Record<string, number>, item) => {
        acc[item.country.toUpperCase()] = item.count;
        return acc;
      },
      {}
    );
  }, [data]);

  const totalSignals = data?.reduce((sum, d) => sum + d.count, 0) || 0;

  const handleMouseEnter = (geo: any, event: MouseEvent) => {
    const countryName = geo.properties.NAME || geo.properties.name;
    const countryCode = (geo.properties.ISO_A2 || geo.properties.iso_a2 || geo.id);
    const count = countryData[String(countryCode).toUpperCase()] || 0;
    
    setTooltip({
      name: countryName,
      count,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleClick = (geo: any) => {
    const countryCode = (geo.properties.ISO_A2 || geo.properties.iso_a2 || geo.id);
    if (countryCode) {
      router.push(`/?country=${countryCode.toUpperCase()}`);
    }
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
    <div className="border border-border rounded-lg p-4 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-500" />
          <h3 className="font-semibold">Signal Density</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
          {totalSignals.toLocaleString()} signals (30d)
        </span>
      </div>

      <div className="relative">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 140 }}
          style={{ width: "100%", height: "300px" }}
        >
          <ZoomableGroup center={[0, 10]}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryCode = (geo.properties.ISO_A2 || geo.properties.iso_a2 || geo.id);
                  const count = countryData[String(countryCode).toUpperCase()] || 0;
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(event) => handleMouseEnter(geo, event as unknown as MouseEvent)}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => handleClick(geo)}
                      style={{
                        default: {
                          fill: count > 0 ? colorScale(count) : "#1e293b",
                          stroke: "#334155",
                          strokeWidth: 0.5,
                          outline: "none",
                          transition: "all 250ms",
                        },
                        hover: {
                          fill: "#a78bfa",
                          stroke: "#f8fafc",
                          strokeWidth: 1,
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: {
                          fill: "#8b5cf6",
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
            className="absolute z-50 bg-popover/95 border border-border rounded-md shadow-xl p-2.5 text-xs pointer-events-none backdrop-blur-md"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 180),
              top: tooltip.y - 80,
            }}
          >
            <p className="font-bold text-popover-foreground">{tooltip.name}</p>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span>{tooltip.count.toLocaleString()} signals detected</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm border border-slate-700" style={{ background: "#1e293b" }} />
          <span>0</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#8b5cf6" }} />
          <span>&lt;20</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#7c3aed" }} />
          <span>20-100</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#6d28d9" }} />
          <span>100-500</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "#4c1d95" }} />
          <span>&gt;500</span>
        </div>
      </div>
    </div>
  );
}