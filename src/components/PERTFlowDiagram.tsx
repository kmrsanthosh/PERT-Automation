import React, { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Node,
  Edge,
  ConnectionLineType,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
} from "react-flow-renderer";
import ELK from "elkjs/lib/elk.bundled.js";
import { Activity } from "./PERTTable";

interface PERTFlowProps {
  activities: Activity[];
}

const elk = new ELK();

const PERTFlow: React.FC<PERTFlowProps> = ({ activities }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const createNodesAndEdges = useCallback(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Create start node
    newNodes.push({
      id: "start",
      sourcePosition: "right" as Position,
      type: "input",
      data: { label: "Start" },
      position: { x: 0, y: 0 },
    });

    // Create nodes for each activity
    activities.forEach((activity) => {
      newNodes.push({
        id: activity.id,
        sourcePosition: "right" as Position,
        targetPosition: "left" as Position,
        data: {
          label: `${activity.activity}\nMean: ${activity.mean.toFixed(
            2
          )}\nVariance: ${activity.variance.toFixed(2)}`,
        },
        position: { x: 0, y: 0 }, // Initial position, will be updated by ELK
      });
    });

    // Create end node
    newNodes.push({
      id: "end",
      targetPosition: "left" as Position,
      type: "output",
      data: { label: "End" },
      position: { x: 0, y: 0 },
    });

    // Create edges
    activities.forEach((activity) => {
      if (activity.predecessors.length > 0) {
        activity.predecessors.forEach((predecessor) => {
          const sourceActivity = activities.find(
            (a) => a.activity === predecessor
          );
          if (sourceActivity) {
            newEdges.push({
              id: `${sourceActivity.id}-${activity.id}`,
              source: sourceActivity.id,
              target: activity.id,
            });
          }
        });
      } else {
        // If no predecessors, connect to start node
        newEdges.push({
          id: `start-${activity.id}`,
          source: "start",
          target: activity.id,
        });
      }
    });

    // Connect activities with no successors to the end node
    activities.forEach((activity) => {
      const hasSuccessor = activities.some((a) =>
        a.predecessors.includes(activity.activity)
      );
      if (!hasSuccessor) {
        newEdges.push({
          id: `${activity.id}-end`,
          source: activity.id,
          target: "end",
        });
      }
    });

    return { nodes: newNodes, edges: newEdges };
  }, [activities]);

  const layoutElements = useCallback(async (nodes: Node[], edges: Edge[]) => {
    const elkGraph = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "50",
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      },
      children: nodes.map((node) => ({
        id: node.id,
        width: 180,
        height: 70,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
    };

    const newGraph = await elk.layout(elkGraph);

    return {
      nodes: nodes.map((node) => {
        const elkNode = newGraph.children?.find((n) => n.id === node.id);
        return {
          ...node,
          position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
        };
      }),
      edges,
    };
  }, []);

  useEffect(() => {
    const updateGraph = async () => {
      const { nodes: initialNodes, edges: initialEdges } =
        createNodesAndEdges();
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        await layoutElements(initialNodes, initialEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    };

    updateGraph();
  }, [activities, createNodesAndEdges, layoutElements, setNodes, setEdges]);

  return (
    <div style={{ width: "100%", height: "500px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

export default PERTFlow;
