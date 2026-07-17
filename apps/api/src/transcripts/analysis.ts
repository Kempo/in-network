export type SpeechSegment = {
  role: "user" | "agent";
  startedAt: number;
  endedAt: number
};

function orderedSegments(segments: SpeechSegment[]): SpeechSegment[] {
  return segments.toSorted((a: SpeechSegment, b: SpeechSegment) => a.startedAt - b.startedAt);
}

export function overlappingIntervals(segments: SpeechSegment[]): SpeechSegment[][] {
  const pairs: SpeechSegment[][] = [];

  let curr = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];

    if (next.startedAt < curr.endedAt) {
      pairs.push([curr, next]);
    }

    if (curr.endedAt < next.endedAt) {
      curr = next;
    }
  }

  return pairs;
}

function talkingTime(segments: SpeechSegment[]): number {
  let total = 0;

  let curr: { startedAt: number, endedAt: number } = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];

    if (next.startedAt < curr.endedAt) {
      curr = {
        startedAt: curr.startedAt,
        endedAt: Math.max(curr.endedAt, next.endedAt)
      };
    } else {
      total += (curr.endedAt - curr.startedAt);

      curr = next;
    }
  }

  total += (curr.endedAt - curr.startedAt);

  return total;
}

export function computeAnalysis(segments: SpeechSegment[]): {
  totalConversationTime: number;
  totalTalkingTime: number;
  numberOfInterruptions: number;
  totalSilence: number;
} {
  if (segments.length === 0) {
    return { totalConversationTime: 0, totalTalkingTime: 0, numberOfInterruptions: 0, totalSilence: 0 };
  }

  const ordered = orderedSegments(segments);

  const minStart = ordered[0].startedAt;
  const maxEnd = ordered[ordered.length - 1].endedAt;

  const totalConversationTime = maxEnd - minStart;
  const totalTalkingTime = talkingTime(ordered);

  return {
    totalConversationTime,
    totalTalkingTime,
    numberOfInterruptions: overlappingIntervals(ordered).length,
    totalSilence: totalConversationTime - totalTalkingTime,
  };
}
