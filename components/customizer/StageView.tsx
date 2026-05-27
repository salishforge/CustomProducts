"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Image as KonvaImage,
  Layer,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";

import type { Layer as DesignLayer } from "@/lib/parse";

/*
 * Konva stage view. Lazy-loaded from Customizer.tsx (react-konva is
 * browser-only). Handles transformer attachment to the selected node and
 * propagates transform/position changes back to the parent state.
 */

type TextLayer = Extract<DesignLayer, { kind: "text" }>;
type ImageLayer = Extract<DesignLayer, { kind: "image" }> & {
  _img?: HTMLImageElement;
};
type RuntimeLayer = TextLayer | ImageLayer;

export default function StageView({
  width,
  height,
  layers,
  selectedId,
  onSelect,
  onChange,
}: {
  width: number;
  height: number;
  layers: RuntimeLayer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<RuntimeLayer>) => void;
}) {
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Map<string, Konva.Node>>(new Map());

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

  const scale = useMemo(() => {
    // The Konva Stage is rendered at intrinsic resolution; the parent div
    // already scales it visually via CSS — we keep the canvas coordinate
    // system fixed so transforms stay deterministic.
    return 0.8;
  }, []);

  return (
    <Stage
      width={width * scale}
      height={height * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        // Click on empty area deselects.
        if (e.target === e.target.getStage()) {
          onSelect(null);
        }
      }}
    >
      <Layer>
        {layers.map((l) => {
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
                draggable
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  onSelect(l.id);
                }}
                onDragEnd={(e) =>
                  onChange(l.id, {
                    transform: {
                      ...l.transform,
                      x: e.target.x(),
                      y: e.target.y(),
                    },
                  })
                }
                onTransformEnd={(e) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  node.scaleX(1);
                  node.scaleY(1);
                  onChange(l.id, {
                    transform: {
                      ...l.transform,
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(20, node.width() * sx),
                      rotation: node.rotation(),
                    },
                    fontSize: Math.max(8, l.fontSize * sx),
                  });
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
                draggable
                onMouseDown={(e) => {
                  e.cancelBubble = true;
                  onSelect(l.id);
                }}
                onDragEnd={(e) =>
                  onChange(l.id, {
                    transform: {
                      ...l.transform,
                      x: e.target.x(),
                      y: e.target.y(),
                    },
                  })
                }
                onTransformEnd={(e) => {
                  const node = e.target;
                  const sx = node.scaleX();
                  const sy = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  onChange(l.id, {
                    transform: {
                      ...l.transform,
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(20, node.width() * sx),
                      height: Math.max(20, node.height() * sy),
                      rotation: node.rotation(),
                    },
                  });
                }}
              />
            );
          }
          return null;
        })}

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
      </Layer>
    </Stage>
  );
}
