import { useEffect, useRef } from "react";
import * as d3 from "d3";

import type { PortFlow } from "../../../../shared/contracts";
import { Badge } from "./Badge";

interface ChordPanelProps {
  flows: PortFlow[];
  selectedPortPair: [string, string] | null;
  onSelect: (flow: PortFlow) => void;
}

export function ChordPanel({
  flows,
  selectedPortPair,
  onSelect
}: ChordPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || flows.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const width = 320;
    const height = 320;
    const outerRadius = Math.min(width, height) * 0.45;
    const innerRadius = outerRadius - 20;
    const ports = [...new Set(flows.flatMap((flow) => [flow.source, flow.target]))];
    const portIndex = new Map(ports.map((port, index) => [port, index]));
    const matrix = Array.from({ length: ports.length }, () =>
      Array.from({ length: ports.length }, () => 0)
    );
    flows.forEach((flow) => {
      matrix[portIndex.get(flow.source) ?? 0][portIndex.get(flow.target) ?? 0] =
        flow.value;
    });
    const color = d3
      .scaleOrdinal<string, string>()
      .domain(ports)
      .range(["#7ac7ff", "#7bf0b4", "#ffc86a", "#df91ff", "#ff8e72"]);
    const chord = d3.chordDirected().padAngle(0.08).sortSubgroups(d3.descending)(matrix);
    const root = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    root
      .append("g")
      .selectAll("path")
      .data(chord.groups)
      .join("path")
      .attr("d", d3.arc().innerRadius(innerRadius).outerRadius(outerRadius) as never)
      .attr("fill", (group) => color(ports[group.index]))
      .attr("stroke", "#09131f");

    root
      .append("g")
      .selectAll("text")
      .data(chord.groups)
      .join("text")
      .attr("transform", (group) => {
        const angle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2;
        const x = Math.cos(angle) * (outerRadius + 12);
        const y = Math.sin(angle) * (outerRadius + 12);
        return `translate(${x},${y})`;
      })
      .attr("text-anchor", "middle")
      .attr("fill", "#d9f2ff")
      .attr("font-size", 11)
      .text((group) => ports[group.index]);

    root
      .append("g")
      .attr("fill-opacity", 0.72)
      .selectAll("path")
      .data(chord)
      .join("path")
      .attr(
        "d",
        d3.ribbonArrow().radius(innerRadius - 1).padAngle(0.02) as never
      )
      .attr("fill", (entry) => color(ports[entry.source.index]))
      .attr("stroke", "rgba(255,255,255,0.08)")
      .style("cursor", "pointer")
      .classed("chord-active", (entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        return (
          selectedPortPair?.[0] === source && selectedPortPair?.[1] === target
        );
      })
      .on("click", (_, entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        const flow = flows.find(
          (item) => item.source === source && item.target === target
        );
        if (flow) onSelect(flow);
      })
      .append("title")
      .text((entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        const value = matrix[entry.source.index][entry.target.index];
        return `${source} → ${target}: ${value}`;
      });
  }, [flows, onSelect, selectedPortPair]);

  const activeFlow =
    selectedPortPair &&
    flows.find(
      (flow) =>
        flow.source === selectedPortPair[0] && flow.target === selectedPortPair[1]
    );

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>港口流向弦图</h3>
        <p>宏观流向 → 航次 drill-down</p>
      </div>
      <svg ref={svgRef} className="chord-svg" />
      {activeFlow ? (
        <div className="chord-caption">
          <div className="caption-row">
            <strong>
              {activeFlow.source} → {activeFlow.target}
            </strong>
            <Badge sourceType={activeFlow.sourceType} />
          </div>
          <p>{activeFlow.description}</p>
        </div>
      ) : null}
    </div>
  );
}
