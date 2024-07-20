import React, { useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  ConnectionLineType,
  Background,
  Controls,
  MiniMap,
} from "react-flow-renderer";
import { Activity } from "./PERTTable";

interface PERTFlowProps {
  activities: Activity[];
}

const PERTFlow: React.FC<PERTFlowProps> = ({ activities }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const createNodesAndEdges = () => {
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      // Create start node
      newNodes.push({
        id: "start",
        data: { label: "Start" },
        position: { x: 0, y: 0 },
        type: "input",
      });

      // Create nodes for each activity
      activities.forEach((activity, index) => {
        newNodes.push({
          id: activity.id,
          data: {
            label: `${activity.activity}\nMean: ${activity.mean.toFixed(
              2
            )}\nVariance: ${activity.variance.toFixed(2)}`,
          },
          position: { x: (index + 1) * 200, y: (index + 1) * 100 },
        });
      });

      // Create end node
      newNodes.push({
        id: "end",
        data: { label: "End" },
        position: { x: (activities.length + 1) * 200, y: 0 },
        type: "output",
      });

      // Create edges
      activities.forEach((activity) => {
        if (!activity.predecessor) {
          newEdges.push({
            id: `start-${activity.id}`,
            source: "start",
            target: activity.id,
            type: "smoothstep",
          });
        } else {
          newEdges.push({
            id: `${activity.predecessor}-${activity.id}`,
            source:
              activities.find((a) => a.activity === activity.predecessor)?.id ||
              "",
            target: activity.id,
            type: "smoothstep",
          });
        }
      });

      // Connect activities with no successors to the end node
      activities.forEach((activity) => {
        if (!activities.some((a) => a.predecessor === activity.activity)) {
          newEdges.push({
            id: `${activity.id}-end`,
            source: activity.id,
            target: "end",
            type: "smoothstep",
          });
        }
      });

      setNodes(newNodes);
      setEdges(newEdges);
    };

    createNodesAndEdges();
  }, [activities]);

  return (
    <div style={{ width: "100%", height: "500px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
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
