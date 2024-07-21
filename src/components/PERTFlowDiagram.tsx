import React, { useEffect, useCallback } from "react";
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

interface PERTActivity extends Activity {
  es: number;
  ef: number;
  ls: number;
  lf: number;
  isCritical: boolean;
}

const elk = new ELK();

const PERTFlow: React.FC<PERTFlowProps> = ({ activities }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const calculatePERT = useCallback(
    (activities: Activity[]): PERTActivity[] => {
      const pertActivities: PERTActivity[] = activities.map((activity) => ({
        ...activity,
        es: 0,
        ef: 0,
        ls: 0,
        lf: 0,
        isCritical: false,
      }));

      // Forward pass
      pertActivities.forEach((activity) => {
        if (activity.predecessors.length === 0) {
          activity.es = 0;
        } else {
          activity.es = Math.max(
            ...activity.predecessors.map((pred) => {
              const predActivity = pertActivities.find(
                (a) => a.activity === pred
              );
              return predActivity ? predActivity.ef : 0;
            })
          );
        }
        activity.ef = activity.es + activity.mean;
      });

      // Backward pass
      const maxEF = Math.max(...pertActivities.map((a) => a.ef));
      pertActivities.reverse().forEach((activity) => {
        if (
          pertActivities.every(
            (a) => !a.predecessors.includes(activity.activity)
          )
        ) {
          activity.lf = maxEF;
        } else {
          activity.lf = Math.min(
            ...pertActivities
              .filter((a) => a.predecessors.includes(activity.activity))
              .map((a) => a.ls)
          );
        }
        activity.ls = activity.lf - activity.mean;
      });

      // Determine critical path
      pertActivities.forEach((activity) => {
        activity.isCritical =
          Math.abs(activity.es - activity.ls) < 0.001 &&
          Math.abs(activity.ef - activity.lf) < 0.001;
      });

      return pertActivities;
    },
    []
  );

  const createNodesAndEdges = useCallback(() => {
    const pertActivities = calculatePERT(activities);
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
    pertActivities.forEach((activity) => {
      newNodes.push({
        id: activity.id,
        sourcePosition: "right" as Position,
        targetPosition: "left" as Position,
        data: {
          label: `ES: ${activity.es.toFixed(2)}\nLS: ${activity.ls.toFixed(2)}`,
        },
        style: activity.isCritical ? { border: "2px solid red" } : {},
        position: { x: 0, y: 0 },
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
    pertActivities.forEach((activity) => {
      if (activity.predecessors.length > 0) {
        activity.predecessors.forEach((predecessor) => {
          const sourceActivity = pertActivities.find(
            (a) => a.activity === predecessor
          );
          if (sourceActivity) {
            newEdges.push({
              id: `${sourceActivity.id}-${activity.id}`,
              source: sourceActivity.id,
              target: activity.id,
              label: `${activity.activity} (${activity.mean.toFixed(2)})`,
              animated: activity.isCritical && sourceActivity.isCritical,
              style:
                activity.isCritical && sourceActivity.isCritical
                  ? { stroke: "red" }
                  : {},
            });
          }
        });
      } else {
        // If no predecessors, connect to start node
        newEdges.push({
          id: `start-${activity.id}`,
          source: "start",
          target: activity.id,
          label: `${activity.activity} (${activity.mean.toFixed(2)})`,
          animated: activity.isCritical,
          style: activity.isCritical ? { stroke: "red" } : {},
        });
      }
    });

    // Connect activities with no successors to the end node
    pertActivities.forEach((activity) => {
      const hasSuccessor = pertActivities.some((a) =>
        a.predecessors.includes(activity.activity)
      );
      if (!hasSuccessor) {
        newEdges.push({
          id: `${activity.id}-end`,
          source: activity.id,
          target: "end",
          animated: activity.isCritical,
          style: activity.isCritical ? { stroke: "red" } : {},
        });
      }
    });

    return { nodes: newNodes, edges: newEdges };
  }, [activities, calculatePERT]);

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
        width: 120,
        height: 60,
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
