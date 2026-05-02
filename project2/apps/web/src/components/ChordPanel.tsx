import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

import type { PortFlow } from "../../../../shared/contracts";

interface ChordPanelProps {
  flows: PortFlow[];
  selectedPortPair: [string, string] | null;
  onSelect: (flow: PortFlow) => void;
}

export function ChordPanel({ flows, selectedPortPair, onSelect }: ChordPanelProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const ports = useMemo(
    () =>
      [...new Set(flows.flatMap((flow) => [flow.source, flow.target]))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [flows]
  );

  useEffect(() => {
    if (!svgRef.current || flows.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 400;
    const height = 400;
    const outerRadius = Math.min(width, height) * 0.42;
    const innerRadius = outerRadius - 28;
    const portIndex = new Map(ports.map((port, index) => [port, index]));
    const matrix = Array.from({ length: ports.length }, () =>
      Array.from({ length: ports.length }, () => 0)
    );

    flows.forEach((flow) => {
      const sourceIndex = portIndex.get(flow.source);
      const targetIndex = portIndex.get(flow.target);
      if (sourceIndex === undefined || targetIndex === undefined) {
        return;
      }
      matrix[sourceIndex][targetIndex] = flow.value;
    });

    const color = d3
      .scaleOrdinal<string, string>()
      .domain(ports)
      .range([
        "#7ac7ff",
        "#7bf0b4",
        "#ffc86a",
        "#df91ff",
        "#ff8e72",
        "#9fe870",
        "#f6b5d8"
      ]);

    const chord = d3.chordDirected().padAngle(0.05).sortSubgroups(d3.descending)(matrix);
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
      .attr("stroke", "rgba(8, 21, 33, 0.95)");

    root
      .append("g")
      .selectAll("text")
      .data(chord.groups)
      .join("text")
      .attr("transform", (group) => {
        const angle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2;
        const x = Math.cos(angle) * (outerRadius + 20);
        const y = Math.sin(angle) * (outerRadius + 20);
        return `translate(${x},${y})`;
      })
      .attr("text-anchor", (group) => {
        const angle = (group.startAngle + group.endAngle) / 2 - Math.PI / 2;
        return Math.cos(angle) >= 0 ? "start" : "end";
      })
      .attr("dominant-baseline", "middle")
      .attr("fill", "#d9f2ff")
      .attr("font-size", 11)
      .attr("font-weight", 600)
      .text((group) => ports[group.index]);

    root
      .append("g")
      .selectAll("path")
      .data(chord)
      .join("path")
      .attr("d", d3.ribbonArrow().radius(innerRadius - 1).padAngle(0.02) as never)
      .attr("fill", (entry) => color(ports[entry.source.index]))
      .attr("stroke", (entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        return selectedPortPair?.[0] === source && selectedPortPair?.[1] === target
          ? "#ffffff"
          : "rgba(255,255,255,0.12)";
      })
      .attr("stroke-width", (entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        return selectedPortPair?.[0] === source && selectedPortPair?.[1] === target ? 2.5 : 1;
      })
      .attr("opacity", (entry) => {
        if (!selectedPortPair) return 0.84;
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        return selectedPortPair[0] === source && selectedPortPair[1] === target ? 1 : 0.68;
      })
      .style("cursor", "pointer")
      .on("click", (_, entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        const flow = flows.find((item) => item.source === source && item.target === target);
        if (flow) {
          onSelect(flow);
        }
      })
      .append("title")
      .text((entry) => {
        const source = ports[entry.source.index];
        const target = ports[entry.target.index];
        const value = matrix[entry.source.index][entry.target.index];
        return `${source} -> ${target}: ${value}`;
      });
  }, [flows, onSelect, ports, selectedPortPair]);

  const activeFlow =
    selectedPortPair &&
    flows.find(
      (flow) => flow.source === selectedPortPair[0] && flow.target === selectedPortPair[1]
    );

  const totalVoyages = flows.reduce((sum, flow) => sum + flow.value, 0);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h3>Port Flow Chord Diagram</h3>
          <p>
            All ports and flows are shown. Click a flow to highlight it and view its explanation.
          </p>
        </div>
      </div>
      <div className="flow-network-summary">
        <div className="flow-network-meta">
          <strong>{ports.length} ports</strong>
          <span>{flows.length} flows</span>
          <span>{totalVoyages} voyages</span>
        </div>
        <div className="flow-port-list">
          {ports.map((port) => (
            <span key={port} className="flow-port-chip">
              {port}
            </span>
          ))}
        </div>
      </div>
      <svg ref={svgRef} className="chord-svg" />
      {activeFlow ? (
        <div className="chord-caption">
          <div className="caption-row">
            <strong>
              {activeFlow.source} -&gt; {activeFlow.target}
            </strong>
          </div>
          <p>{activeFlow.description}</p>
        </div>
      ) : null}
    </div>
  );
}
