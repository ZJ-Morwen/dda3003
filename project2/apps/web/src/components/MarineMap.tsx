import React, { useEffect, useRef } from "react";

const velocityDataUrls = {
  wind: new URL("../../../../wind-global.json", import.meta.url).href,
  current: new URL("../../../../ocean-current-global.json", import.meta.url).href
} as const;

const velocityLayerConfig = {
  wind: {
    maxVelocity: 15,
    velocityScale: 0.01,
    colorScale: ["#d8dde3", "#f4f6f8", "#ffffff"]
  },
  current: {
    maxVelocity: 1.5,
    velocityScale: 0.1,
    colorScale: ["#146cff", "#57b6ff", "#d7f1ff"]
  }
} as const;

const PORT_VIEW_BOUNDS = [
  [19.5, 111.2],
  [41.0, 125.2]
] as const;

const PORT_LOCATIONS = [
  {
    name: "Tianjin",
    lat: 39.45,
    lon: 119.32,
    region: "Bohai Rim",
    role: "Northern China gateway port",
    routes: "Qingdao, Shanghai"
  },
  {
    name: "Qingdao",
    lat: 36.01,
    lon: 120.47,
    region: "Shandong Peninsula",
    role: "Container and bulk cargo hub",
    routes: "Tianjin, Ningbo"
  },
  {
    name: "Ningbo",
    lat: 29.98,
    lon: 122.52,
    region: "Yangtze River Delta",
    role: "Major deep-water container port",
    routes: "Qingdao, Shanghai, Shenzhen, Guangzhou"
  },
  {
    name: "Shanghai",
    lat: 31.28,
    lon: 122.02,
    region: "Yangtze River Delta",
    role: "International shipping center",
    routes: "Ningbo, Tianjin"
  },
  {
    name: "Shenzhen",
    lat: 22.43,
    lon: 114.6,
    region: "Pearl River Delta",
    role: "South China container gateway",
    routes: "Ningbo"
  },
  {
    name: "Guangzhou",
    lat: 21.96,
    lon: 113.85,
    region: "Pearl River Delta",
    role: "Regional shipping and trade hub",
    routes: "Ningbo"
  }
] as const;

declare global {
  interface Window {
    L: any;
    $: any;
  }
}

interface MarineMapProps {
  mode: "wind" | "current";
  geometry: any;
  points: any[];
  onSelectTimestamp: (ts: string) => void;
}

function toLatLngs(coordinates: [number, number][]): [number, number][] {
  return coordinates.map(([lon, lat]) => [lat, lon]);
}

function formatNumber(value: unknown, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      })
    : "--";
}

function routeTooltip(title: string, metrics: any, recommended = false): string {
  return `
    <div class="route-tooltip-card">
      <strong>${title}${recommended ? " · Recommended" : ""}</strong>
      <span>Distance: ${formatNumber(metrics?.distanceNm, 1)} NM</span>
      <span>Avg speed: ${formatNumber(metrics?.avgSpeed, 1)} kt</span>
      <span>Emission: ${formatNumber(metrics?.totalEmission, 1)} score</span>
      <span>Emission/NM: ${formatNumber(metrics?.emissionPerNm, 1)}</span>
      ${
        typeof metrics?.reductionPercent === "number"
          ? `<span>Reduction: ${formatNumber(metrics.reductionPercent, 1)}%</span>`
          : ""
      }
    </div>
  `;
}

function portTooltip(port: (typeof PORT_LOCATIONS)[number]): string {
  return `
    <div class="port-tooltip-card">
      <strong>${port.name}</strong>
      <span>Region: ${port.region}</span>
      <span>Role: ${port.role}</span>
      <span>Dataset routes: ${port.routes}</span>
      <span>Location: ${formatNumber(port.lat, 2)}, ${formatNumber(port.lon, 2)}</span>
    </div>
  `;
}

const MarineMap: React.FC<MarineMapProps> = ({ mode, geometry, points, onSelectTimestamp }) => {
  const mapRef = useRef<any>(null);
  const velocityLayerRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);
  const pointLayerGroupRef = useRef<any>(null);
  const canvasRendererRef = useRef<any>(null);

  useEffect(() => {
    const map = window.L.map("marine-map-container", {
      zoomControl: false,
      maxBounds: PORT_VIEW_BOUNDS,
      maxBoundsViscosity: 1,
      zoomDelta: 0.5,
      zoomSnap: 0.25
    });

    map.fitBounds(PORT_VIEW_BOUNDS, { animate: false, padding: [16, 16] });
    map.setMinZoom(map.getZoom());
    window.L.control.zoom({ position: "topright" }).addTo(map);
    canvasRendererRef.current = window.L.canvas({ padding: 0.5 });
    mapRef.current = map;

    map.createPane("landPane");
    map.getPane("landPane").style.zIndex = "450";
    map.createPane("routePane");
    map.getPane("routePane").style.zIndex = "470";
    map.createPane("pointPane");
    map.getPane("pointPane").style.zIndex = "480";
    map.createPane("portPane");
    map.getPane("portPane").style.zIndex = "490";
    map.createPane("labelPane");
    map.getPane("labelPane").style.zIndex = "500";
    map.getPane("labelPane").style.pointerEvents = "none";

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png").addTo(map);

    fetch("https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json")
      .then((res) => res.json())
      .then((data) => {
        window.L.geoJSON(data, {
          pane: "landPane",
          style: { fillColor: "#ead8ad", fillOpacity: 1, color: "#7b6f55", weight: 1 }
        }).addTo(map);
      });

    window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      pane: "labelPane"
    }).addTo(map);

    const portGroup = window.L.layerGroup();
    PORT_LOCATIONS.forEach((port) => {
      const marker = window.L.circleMarker([port.lat, port.lon], {
        pane: "portPane",
        radius: 8,
        color: "#f8fafc",
        weight: 2,
        fillColor: "#4de3d6",
        fillOpacity: 0.28,
        opacity: 0.95
      });
      marker.bindTooltip(portTooltip(port), {
        sticky: true,
        className: "port-hover-tooltip"
      });
      marker.on("mouseover", () =>
        marker.setStyle({
          radius: 10,
          weight: 3,
          fillOpacity: 0.42
        })
      );
      marker.on("mouseout", () =>
        marker.setStyle({
          radius: 8,
          weight: 2,
          fillOpacity: 0.28
        })
      );
      marker.addTo(portGroup);
    });
    portGroup.addTo(map);

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (velocityLayerRef.current) {
      mapRef.current.removeLayer(velocityLayerRef.current);
    }

    const map = mapRef.current;
    const controller = new AbortController();
    let cancelled = false;

    fetch(velocityDataUrls[mode], { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${mode} velocity data`);
        }
        return response.json();
      })
      .then((data) => {
        if (cancelled || !mapRef.current) return;
        const layer = window.L.velocityLayer({
          displayValues: false,
          data,
          ...velocityLayerConfig[mode]
        });
        layer.addTo(map);
        velocityLayerRef.current = layer;
      })
      .catch((error) => {
        if (!cancelled && error instanceof Error && error.name !== "AbortError") {
          console.error(error);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [mode]);

  useEffect(() => {
    if (!mapRef.current || !geometry) return;

    const map = mapRef.current;

    if (routeLayerGroupRef.current) {
      map.removeLayer(routeLayerGroupRef.current);
    }

    const routeGroup = window.L.featureGroup();
    const renderer = canvasRendererRef.current;

    const bestRoutes = Array.isArray(geometry.bestRoutes) ? geometry.bestRoutes : [];

    bestRoutes.forEach((route: any) => {
      const line = window.L.polyline(toLatLngs(route.coordinates), {
        pane: "routePane",
        color: "#4de3d6",
        weight: route.isRecommended ? 4 : 2.8,
        opacity: route.isRecommended ? 0.95 : 0.68,
        smoothFactor: 0,
        noClip: true,
        renderer
      });
      line.bindTooltip(routeTooltip(route.label ?? `Top ${route.rank} Best Route`, route, route.isRecommended), {
        sticky: true,
        className: "route-hover-tooltip"
      });
      line.on("mouseover", () => line.setStyle({ weight: route.isRecommended ? 5 : 4.2, opacity: 1 }));
      line.on("mouseout", () =>
        line.setStyle({ weight: route.isRecommended ? 4 : 2.8, opacity: route.isRecommended ? 0.95 : 0.68 })
      );
      line.addTo(routeGroup);
    });

    if (bestRoutes.length === 0 && geometry.referenceRoute?.coordinates?.length) {
      window.L.polyline(toLatLngs(geometry.referenceRoute.coordinates), {
        pane: "routePane",
        color: "#4de3d6",
        weight: 3,
        opacity: 0.82,
        smoothFactor: 0,
        noClip: true,
        renderer
      }).addTo(routeGroup);
    }

    if (geometry.actualRoute?.coordinates?.length) {
      const actualLine = window.L.polyline(toLatLngs(geometry.actualRoute.coordinates), {
        pane: "routePane",
        color: "#ff9f6e",
        weight: 4,
        opacity: 0.96,
        smoothFactor: 0,
        noClip: true,
        renderer
      });
      actualLine.bindTooltip(routeTooltip("Actual AIS Route", geometry.actualMetrics), {
        sticky: true,
        className: "route-hover-tooltip"
      });
      actualLine.on("mouseover", () => actualLine.setStyle({ weight: 5.2, opacity: 1 }));
      actualLine.on("mouseout", () => actualLine.setStyle({ weight: 4, opacity: 0.96 }));
      actualLine.addTo(routeGroup);
    }

    routeGroup.addTo(map);
    routeLayerGroupRef.current = routeGroup;

    const bounds = routeGroup.getBounds?.();
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [70, 70], animate: false, maxZoom: 8 });
    }
  }, [geometry]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    if (pointLayerGroupRef.current) {
      map.removeLayer(pointLayerGroupRef.current);
    }

    const pointGroup = window.L.layerGroup();
    const renderer = canvasRendererRef.current;

    points.forEach((point, index) => {
      const marker = window.L.circleMarker([point.lat, point.lon], {
        pane: "pointPane",
        radius: index === 0 || index === points.length - 1 ? 4.2 : 3,
        color: "#ffe6a7",
        weight: 1,
        fillColor: "#ff9f6e",
        fillOpacity: 0.92,
        renderer
      });
      marker.bindTooltip(point.ts, { sticky: true });
      marker.on("click", () => onSelectTimestamp(point.ts));
      marker.addTo(pointGroup);
    });

    pointGroup.addTo(map);
    pointLayerGroupRef.current = pointGroup;
  }, [onSelectTimestamp, points]);

  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    const handleClick = (event: any) => {
      const nearest = points
        .map((point) => ({
          ts: point.ts,
          distance: (point.lat - event.latlng.lat) ** 2 + (point.lon - event.latlng.lng) ** 2
        }))
        .sort((left, right) => left.distance - right.distance)[0];

      if (nearest) {
        onSelectTimestamp(nearest.ts);
      }
    };

    mapRef.current.on("click", handleClick);
    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleClick);
      }
    };
  }, [onSelectTimestamp, points]);

  return (
    <div
      id="marine-map-container"
      style={{
        width: "100%",
        height: "100%",
        background: "#081722",
        borderRadius: "4px"
      }}
    />
  );
};

export default MarineMap;
