import { useState, useRef, useEffect } from 'react';
import type { StageKey } from './WaterfallStageCard';
import { STAGE_ORDER } from './waterfallConstants';

export function useStageTimings(steps: {
  planner: { status: string };
  executor: { status: string };
  reviewer: { status: string };
}): Partial<Record<StageKey, number>> {
  const stageStartTimes = useRef<Record<StageKey, number | null>>({
    planner:  null,
    executor: null,
    reviewer: null,
  });
  const [stageTimings, setStageTimings] = useState<Partial<Record<StageKey, number>>>({});

  useEffect(() => {
    STAGE_ORDER.forEach((stage) => {
      const status = steps[stage].status;
      if (status === 'processing' && stageStartTimes.current[stage] === null) {
        stageStartTimes.current[stage] = Date.now();
      } else if (status === 'completed' && stageStartTimes.current[stage] !== null) {
        setStageTimings((prev) => ({
          ...prev,
          [stage]: Date.now() - (stageStartTimes.current[stage] as number),
        }));
        stageStartTimes.current[stage] = null;
      }
    });
  }, [
    steps.planner.status,
    steps.executor.status,
    steps.reviewer.status,
  ]);

  return stageTimings;
}
