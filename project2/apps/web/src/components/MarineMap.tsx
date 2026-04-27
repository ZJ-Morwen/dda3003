import React, { useEffect, useRef } from 'react';

const velocityDataUrls = {
  wind: new URL("../../../../wind-global.json", import.meta.url).href,
  current: new URL("../../../../ocean-current-global.json", import.meta.url).href
} as const;

const velocityLayerConfig = {
  wind: { maxVelocity: 15, velocityScale: 0.01, colorScale: ["#d8dde3", "#f4f6f8", "#ffffff"] },
  current: { maxVelocity: 1.5, velocityScale: 0.1, colorScale: ["#146cff", "#57b6ff", "#d7f1ff"] }
} as const;

const CHINA_COAST_BOUNDS = [
  [13, 104],
  [47, 150.5]
] as const;

// 强行向 TypeScript 声明全局变量，解决红线报错
declare global {
  interface Window {
    L: any;
    $: any;
  }
}

interface MarineMapProps {
  mode: 'wind' | 'current';
  geometry: any; // 接收航线数据
  points: any[]; // 接收轨迹点
  onSelectTimestamp: (ts: string) => void;
}

const MarineMap: React.FC<MarineMapProps> = ({ mode, geometry, points, onSelectTimestamp }) => {
  const mapRef = useRef<any>(null);
  const velocityLayerRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);

  // 1. 初始化基础地图与遮罩
  useEffect(() => {
    const map = window.L.map('marine-map-container', {
      zoomControl: false,
      maxBounds: CHINA_COAST_BOUNDS,
      maxBoundsViscosity: 1,
      zoomDelta: 0.5,
      zoomSnap: 0.25
    });
    map.fitBounds(CHINA_COAST_BOUNDS, { animate: false, padding: [0, 0] });
    map.setMinZoom(map.getZoom());
    window.L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    // 创建层级：陆地盖住流体，标签盖住陆地
    map.createPane('landPane');
    map.getPane('landPane').style.zIndex = '450';
    map.createPane('labelPane');
    map.getPane('labelPane').style.zIndex = '500';
    map.getPane('labelPane').style.pointerEvents = 'none';

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png').addTo(map);

    // 加载陆地遮罩，使用与你们项目一致的深海蓝背景色 #081722
    fetch('https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json')
      .then(res => res.json())
      .then(data => {
        window.L.geoJSON(data, {
          pane: 'landPane',
          style: { fillColor: '#ead8ad', fillOpacity: 1, color: '#7b6f55', weight: 1 } 
        }).addTo(map);
      });

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
      pane: 'labelPane'
    }).addTo(map);

    return () => map.remove();
  }, []);

  // 2. 渲染动态粒子场
  useEffect(() => {
    if (!mapRef.current) return;
    if (velocityLayerRef.current) mapRef.current.removeLayer(velocityLayerRef.current);

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
      // 从你原代码中提取的主题配色
      const layer = window.L.velocityLayer({
        displayValues: false, // 隐藏左下角自带的数据框，因为你已经有自己的仪表盘了
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

  // 3. 渲染航线 (复刻原 MapLibre 的样式与逻辑)
  useEffect(() => {
    if (!mapRef.current || !geometry) return;
    const map = mapRef.current;

    if (routeLayerGroupRef.current) {
      map.removeLayer(routeLayerGroupRef.current);
    }

    const routeGroup = window.L.featureGroup();

    // 参考航线 (青色虚线)
    if (geometry.referenceRoute) {
      window.L.geoJSON(geometry.referenceRoute, {
        style: { color: '#4de3d6', weight: 3, dashArray: '5, 5', opacity: 0.8 }
      }).addTo(routeGroup);
    }

    // 实际航线 (橙色实线)
    if (geometry.actualRoute) {
      window.L.geoJSON(geometry.actualRoute, {
        style: { color: '#ff9f6e', weight: 4, opacity: 0.95 }
      }).addTo(routeGroup);
    }

    routeGroup.addTo(map);
    routeLayerGroupRef.current = routeGroup;

    // 根据航线自适应缩放视野 (Maplibre 格式转换 Leaflet 格式)
  }, [geometry]);

  // 4. 处理地图点击选取时间戳事件
  useEffect(() => {
    if (!mapRef.current || !points || points.length === 0) return;
    
    const handleClick = (e: any) => {
      const nearest = [...points]
        .map((point) => ({
          ts: point.ts,
          distance: (point.lat - e.latlng.lat) ** 2 + (point.lon - e.latlng.lng) ** 2
        }))
        .sort((left, right) => left.distance - right.distance)[0];
        
      if (nearest) onSelectTimestamp(nearest.ts);
    };

    mapRef.current.on('click', handleClick);
    return () => {
      if (mapRef.current) mapRef.current.off('click', handleClick);
    };
  }, [points, onSelectTimestamp]);

  return <div id="marine-map-container" style={{ width: '100%', height: '100%', background: '#081722', borderRadius: '4px' }} />;
};

export default MarineMap;
