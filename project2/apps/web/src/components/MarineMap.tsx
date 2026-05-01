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

const CHINA_COAST_BOUNDS = [
  [13, 104],
  [47, 150.5]
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

const MarineMap: React.FC<MarineMapProps> = ({ mode, geometry, points, onSelectTimestamp }) => {
  const mapRef = useRef<any>(null);
  const velocityLayerRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);
  const pointLayerGroupRef = useRef<any>(null);
  const canvasRendererRef = useRef<any>(null);

  useEffect(() => {
    const map = window.L.map("marine-map-container", {
      zoomControl: false,
      maxBounds: CHINA_COAST_BOUNDS,
      maxBoundsViscosity: 1,
      zoomDelta: 0.5,
      zoomSnap: 0.25
    });

    map.fitBounds(CHINA_COAST_BOUNDS, { animate: false, padding: [0, 0] });
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

    if (geometry.referenceRoute?.coordinates?.length) {
      window.L.polyline(toLatLngs(geometry.referenceRoute.coordinates), {
        pane: "routePane",
        color: "#4de3d6",
        weight: 3,
        dashArray: "5, 5",
        opacity: 0.82,
        smoothFactor: 0,
        noClip: true,
        renderer
      }).addTo(routeGroup);
    }

    if (geometry.actualRoute?.coordinates?.length) {
      window.L.polyline(toLatLngs(geometry.actualRoute.coordinates), {
        pane: "routePane",
        color: "#ff9f6e",
        weight: 4,
        opacity: 0.96,
        smoothFactor: 0,
        noClip: true,
        renderer
      }).addTo(routeGroup);
    }

    routeGroup.addTo(map);
    routeLayerGroupRef.current = routeGroup;

    const bounds = routeGroup.getBounds?.();
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], animate: false });
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
