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

// Mapping for world-atlas numeric IDs to ISO-A2
const ID_TO_ISO: Record<string, string> = {
  "840": "US",
  "826": "GB",
  "250": "FR",
  "276": "DE",
  "356": "IN",
  "156": "CN",
  "392": "JP",
  "643": "RU",
  "076": "BR",
  "036": "AU",
  "124": "CA",
  "410": "KR",
  "702": "SG",
  "344": "HK",
  "158": "TW",
  "376": "IL",
  "784": "AE",
  "682": "SA",
  "528": "NL",
  "752": "SE",
  "578": "NO",
  "208": "DK",
  "246": "FI",
  "756": "CH",
  "040": "AT",
  "056": "BE",
  "372": "IE",
  "616": "PL",
  "380": "IT",
  "724": "ES",
  "620": "PT",
  "300": "GR",
  "203": "CZ",
  "348": "HU",
  "642": "RO",
  "804": "UA",
  "792": "TR",
  "360": "ID",
  "458": "MY",
  "764": "TH",
  "608": "PH",
  "704": "VN",
  "554": "NZ",
  "710": "ZA",
  "818": "EG",
  "566": "NG",
  "404": "KE",
  "634": "QA",
};

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
    const countryName = geo.properties?.name || geo.properties?.NAME || "Unknown";
    const numericId = String(geo.id).padStart(3, "0");
    const countryCode = ID_TO_ISO[numericId] || (geo.properties?.ISO_A2 || geo.properties?.iso_a2 || geo.id);
    const count = countryData[String(countryCode).toUpperCase()] || 0;
    
    setTooltip({
      name: countryName,
      count,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleClick = (geo: any) => {
    const numericId = String(geo.id).padStart(3, "0");
    const countryCode = ID_TO_ISO[numericId] || (geo.properties?.ISO_A2 || geo.properties?.iso_a2 || geo.id);
    if (countryCode) {
      router.push(`/?country=${String(countryCode).toUpperCase()}`);
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

      <div className="relative overflow-hidden rounded-md">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 100, center: [0, 20] }}
          style={{ width: "100%", height: "280px" }}
        >
          <ZoomableGroup scale={1} center={[0, 20]}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies && geographies.length > 0 ? (
                  geographies.map((geo) => {
                    const numericId = String(geo.id).padStart(3, "0");
                    const countryCode = ID_TO_ISO[numericId] || (geo.properties?.ISO_A2 || geo.properties?.iso_a2 || geo.id);
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
                ) : (
                  <text x="50%" y="50%" textAnchor="middle" fill="#94a3b8" fontSize="12">
                    Loading map data...
                  </text>
                )
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