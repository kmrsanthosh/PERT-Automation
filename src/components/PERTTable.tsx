import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CSVLink } from "react-csv";
import { useMediaQuery } from "react-responsive";
import PERTFlow from "./PERTFlowDiagram";
import { Trash2 } from "lucide-react";

export interface Activity {
  id: string;
  activity: string;
  predecessors: string[];
  optimisticTime: number;
  mostLikelyTime: number;
  pessimisticTime: number;
  mean: number;
  variance: number;
}

const PERTTable: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Activity;
    direction: "ascending" | "descending";
  } | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery({ query: "(max-width: 640px)" });

  const createNewActivity = useCallback(
    (id: string): Activity => ({
      id,
      activity: "",
      predecessors: [],
      optimisticTime: 0,
      mostLikelyTime: 0,
      pessimisticTime: 0,
      mean: 0,
      variance: 0,
    }),
    []
  );

  useEffect(() => {
    try {
      const savedActivities = localStorage.getItem("pertActivities");
      if (savedActivities) {
        setActivities(JSON.parse(savedActivities));
      } else {
        setActivities([createNewActivity("1")]);
      }
    } catch (err) {
      console.error("Error loading saved activities:", err);
      setError("Failed to load saved activities. Starting with a fresh table.");
      setActivities([createNewActivity("1")]);
    }
  }, [createNewActivity]);

  useEffect(() => {
    try {
      localStorage.setItem("pertActivities", JSON.stringify(activities));
    } catch (err) {
      console.error("Error saving activities:", err);
      setError("Failed to save activities to local storage.");
    }
  }, [activities]);

  const calculateMean = (activity: Activity): number => {
    return (
      (activity.optimisticTime +
        4 * activity.mostLikelyTime +
        activity.pessimisticTime) /
      6
    );
  };

  const calculateVariance = (activity: Activity): number => {
    return Math.pow(
      (activity.pessimisticTime - activity.optimisticTime) / 6,
      2
    );
  };

  const updateActivity = useCallback(
    (id: string, field: keyof Activity, value: string | number | string[]) => {
      setActivities((prevActivities) =>
        prevActivities.map((activity) => {
          if (activity.id === id) {
            const updatedActivity = { ...activity, [field]: value };
            if (
              field === "activity" &&
              typeof value === "string" &&
              !/^[A-Za-z]*$/.test(value)
            ) {
              setError("Activities can only contain letters.");
              return activity;
            }
            if (
              ["optimisticTime", "mostLikelyTime", "pessimisticTime"].includes(
                field
              ) &&
              typeof value === "number" &&
              value < 0
            ) {
              setError("Time values must be non-negative.");
              return activity;
            }
            setError(null);
            return {
              ...updatedActivity,
              mean: calculateMean(updatedActivity),
              variance: calculateVariance(updatedActivity),
            };
          }
          return activity;
        })
      );
    },
    []
  );

  const addNewRow = () => {
    try {
      const newId = (
        Math.max(...activities.map((a) => parseInt(a.id)), 0) + 1
      ).toString();
      setActivities((prevActivities) => [
        ...prevActivities,
        createNewActivity(newId),
      ]);
    } catch (err) {
      console.error("Error adding new row:", err);
      setError("Failed to add a new row. Please try again.");
    }
  };

  const deleteRow = (id: string) => {
    setActivities((prevActivities) =>
      prevActivities.filter((activity) => activity.id !== id)
    );
  };

  const sortedActivities = React.useMemo(() => {
    let sortableActivities = [...activities];
    if (sortConfig !== null) {
      sortableActivities.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableActivities.filter((activity) =>
      activity.activity.toLowerCase().includes(filter.toLowerCase())
    );
  }, [activities, sortConfig, filter]);

  const requestSort = (key: keyof Activity) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PERT Analysis</h1>
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Filter activities..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className={isMobile ? "overflow-x-auto" : ""}>
        <Table>
          <TableCaption>
            Program Evaluation and Review Technique (PERT) Table
          </TableCaption>
          <TableHeader>
            <TableRow>
              {[
                "Activities",
                "Immediate Predecessors",
                "Optimistic Time",
                "Most Likely Time",
                "Pessimistic Time",
                "Mean",
                "Variance",
                "Actions",
              ].map((header, index) => (
                <TableHead
                  key={index}
                  onClick={() =>
                    requestSort(
                      header.toLowerCase().replace(" ", "") as keyof Activity
                    )
                  }
                  className="cursor-pointer"
                >
                  {header}
                  {sortConfig?.key === header.toLowerCase().replace(" ", "") &&
                    (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedActivities.map((activity) => (
              <TableRow key={activity.id} className="group">
                <TableCell>
                  <Input
                    value={activity.activity}
                    onChange={(e) =>
                      updateActivity(activity.id, "activity", e.target.value)
                    }
                    aria-label="Activity name"
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full">
                        {activity.predecessors.length > 0
                          ? activity.predecessors.join(", ")
                          : "None"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuCheckboxItem
                        checked={activity.predecessors.length === 0}
                        onCheckedChange={() =>
                          updateActivity(activity.id, "predecessors", [])
                        }
                      >
                        None
                      </DropdownMenuCheckboxItem>
                      {activities
                        .filter((a) => a.id !== activity.id && a.activity)
                        .map((a) => (
                          <DropdownMenuCheckboxItem
                            key={a.id}
                            checked={activity.predecessors.includes(a.activity)}
                            onCheckedChange={(checked) => {
                              const newPredecessors = checked
                                ? [...activity.predecessors, a.activity]
                                : activity.predecessors.filter(
                                    (p) => p !== a.activity
                                  );
                              updateActivity(
                                activity.id,
                                "predecessors",
                                newPredecessors
                              );
                            }}
                          >
                            {a.activity}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    value={activity.optimisticTime}
                    onChange={(e) =>
                      updateActivity(
                        activity.id,
                        "optimisticTime",
                        parseInt(e.target.value)
                      )
                    }
                    aria-label="Optimistic time"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={activity.mostLikelyTime}
                    onChange={(e) =>
                      updateActivity(
                        activity.id,
                        "mostLikelyTime",
                        parseInt(e.target.value)
                      )
                    }
                    aria-label="Most likely time"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={activity.pessimisticTime}
                    onChange={(e) =>
                      updateActivity(
                        activity.id,
                        "pessimisticTime",
                        parseInt(e.target.value)
                      )
                    }
                    aria-label="Pessimistic time"
                  />
                </TableCell>
                <TableCell>{activity.mean.toFixed(2)}</TableCell>
                <TableCell>{activity.variance.toFixed(2)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRow(activity.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 space-x-2">
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">PERT Flow Diagram</h2>
          <PERTFlow activities={activities} />
        </div>

        <Button onClick={addNewRow}>Add Row</Button>
        <CSVLink
          data={activities}
          filename={"pert-table.csv"}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          Export to CSV
        </CSVLink>
      </div>
    </div>
  );
};

export default PERTTable;
