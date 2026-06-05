"use client";

import { useEffect, useRef, useState } from "react";
import {
  Image as KonvaImage,
  Layer as KonvaLayer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";

import type { RuntimeLayer, ZoneOverlay } from "./Customizer";

/*
 * Konva stage view.
 *
 * Snap-to-guides: while dragging, compares the dragged node's left/center/
 * right and top/middle/bottom to the canvas's left/center/right and top/
 * middle/bottom; emits Line shapes for each active alignment and snaps the
 * node within `snapThreshold` px.
 *
 * Locked layers ignore pointer input; hidden layers don't render.
 */

type Guides = {
  vertical: Array<{ x: number }>;
  horizontal: Array<{ y: number }>;
};

export default function StageView({
  width,
  height,
  displayScale,
  snapThreshold,
  layers,
  zones,
  selectedId,
  onSelect,
  onChange,
}: {
  width: number;
  height: number;
  displayScale: number;
  snapThreshold: number;
  layers: RuntimeLayer[];
  zones: ZoneOverlay[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (
    id: string,
    patch: Partial<RuntimeLayer>,
    commit: boolean,
  ) => void;
}) {
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());
  const [guides, setGuides] = useState<Guides>({ vertical: [], horizontal: [] });

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = nodeRefs.current.get(selectedId);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, layers]);

  // --- Snap math ----------------------------------------------------------

  function snapLine(value: number, anchors: number[]): number | null {
    for (const a of anchors) {
      if (Math.abs(value - a) < snapThreshold) return a;
    }
    return null;
  }

  function applyDragSnap(node: Konva.Node) {
    const box = node.getClientRect({ relativeTo: node.getParent() as Konva.Container });
    const xs = [0, width / 2 - box.width / 2, width - box.width];
    const ys = [0, height / 2 - box.height / 2, height - box.height];
    const px = node.x();
    const py = node.y();
    const sx = snapLine(px, xs);
    const sy = snapLine(py, ys);
    if (sx !== null) node.x(sx);
    if (sy !== null) node.y(sy);

    const activeGuides: Guides = { vertical: [], horizontal: [] };
    if (sx !== null) activeGuides.vertical.push({ x: sx + box.width / 2 });
    if (sy !== null) activeGuides.horizontal.push({ y: sy + box.height / 2 });
    // Center alignment guides relative to canvas center
    if (sx === width / 2 - box.width / 2) activeGuides.vertical.push({ x: width / 2 });
    if (sy === height / 2 - box.height / 2) activeGuides.horizontal.push({ y: height / 2 });
    setGuides(activeGuides);
  }

  function clearGuides() {
    setGuides({ vertical: [], horizontal: [] });
  }

  return (
    <Stage
      width={width * displayScale}
      height={height * displayScale}
      scaleX={displayScale}
      scaleY={displayScale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) {
          onSelect(null);
        }
      }}
    >
      <KonvaLayer>
        {/* Decoration-zone boundaries — drawn behind artwork, non-interactive. */}
        {zones.map((z) => (
          <Rect
            key={z.id}
            x={z.x}
            y={z.y}
            width={z.width}
            height={z.height}
            rotation={z.rotation}
            stroke="oklch(68% 0.18 38)"
            strokeWidth={1.5}
            dash={[8, 6]}
            fill="oklch(68% 0.18 38 / 0.04)"
            listening={false}
          />
        ))}
        {zones.map((z) => (
          <Text
            key={`label-${z.id}`}
            x={z.x}
            y={z.y - 18}
            text={z.name}
            fontSize={13}
            fontFamily="monospace"
            fill="oklch(58% 0.16 38)"
            listening={false}
          />
        ))}

        {layers.map((l) => {
          if (l._hidden) return null;
          const draggable = !l._locked;
          if (l.kind === "text") {
            return (
              <Text
                key={l.id}
                ref={(node) => {
                  if (node) nodeRefs.current.set(l.id, node);
                  else nodeRefs.current.delete(l.id);
                }}
                x={l.transform.x}
                y={l.transform.y}
                width={l.transform.width}
                rotation={l.transform.rotation}
                text={l.content}
                fontFamily={l.fontFamily}
                fontSize={l.fontSize}
                fontStyle={String(l.fontWeight)}
                fill={l.color}
                draggable={draggable}
                listening={!l._locked}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  onSelect(l.id);
                }}
                onDragMove={(e) => applyDragSnap(e.target)}
                onDragEnd={(e) => {
                  clearGuides();
                  onChange(
                    l.id,
                    {
                      transform: {
                        ...l.transform,
                        x: e.target.x(),
                        y: e.target.y(),
                      },
                    },
                    true,
                  );
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  node.scaleX(1);
                  node.scaleY(1);
                  onChange(
                    l.id,
                    {
                      transform: {
                        ...l.transform,
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(20, node.width() * sx),
                        rotation: node.rotation(),
                      },
                      fontSize: Math.max(8, l.fontSize * sx),
                    },
                    true,
                  );
                }}
              />
            );
          }
          if (l.kind === "image" && l._img) {
            return (
              <KonvaImage
                key={l.id}
                ref={(node) => {
                  if (node) nodeRefs.current.set(l.id, node);
                  else nodeRefs.current.delete(l.id);
                }}
                image={l._img}
                x={l.transform.x}
                y={l.transform.y}
                width={l.transform.width}
                height={l.transform.height}
                rotation={l.transform.rotation}
                draggable={draggable}
                listening={!l._locked}
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  onSelect(l.id);
                }}
                onDragMove={(e) => applyDragSnap(e.target)}
                onDragEnd={(e) => {
                  clearGuides();
                  onChange(
                    l.id,
                    {
                      transform: {
                        ...l.transform,
                        x: e.target.x(),
                        y: e.target.y(),
                      },
                    },
                    true,
                  );
                }}
                onTransformEnd={(e) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  const sy = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  onChange(
                    l.id,
                    {
                      transform: {
                        ...l.transform,
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(20, node.width() * sx),
                        height: Math.max(20, node.height() * sy),
                        rotation: node.rotation(),
                      },
                    },
                    true,
                  );
                }}
              />
            );
          }
          return null;
        })}

        {/* Snap guides — emitted on top of layers, below the transformer. */}
        {guides.vertical.map((g, i) => (
          <Line
            key={`v-${i}`}
            points={[g.x, 0, g.x, height]}
            stroke="oklch(68% 0.18 38)"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ))}
        {guides.horizontal.map((g, i) => (
          <Line
            key={`h-${i}`}
            points={[0, g.y, width, g.y]}
            stroke="oklch(68% 0.18 38)"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        ))}

        <Transformer
          ref={trRef}
          rotateEnabled
          flipEnabled={false}
          borderStroke="oklch(68% 0.18 38)"
          anchorStroke="oklch(68% 0.18 38)"
          anchorFill="oklch(98.5% 0.004 85)"
          anchorSize={8}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      </KonvaLayer>
    </Stage>
  );
}
