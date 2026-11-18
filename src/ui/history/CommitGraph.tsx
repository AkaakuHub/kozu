import type { ScoreBranch, ScoreCommit } from '../../core/history/revisions.ts';

export function CommitGraph({
  commits,
  branches,
  selected,
  choose,
}: {
  commits: ScoreCommit[];
  branches: ScoreBranch[];
  selected: string;
  choose: (id: string) => void;
}) {
  const row = 38;
  const colors = ['#3ca591', '#9b77e1', '#d37c37', '#5e94d0'];
  const lanes: (string | null)[] = [];
  const positions = new Map<string, { x: number; y: number; color: string }>();
  for (const [i, commit] of commits.entries()) {
    let lane = lanes.indexOf(commit.id);
    if (lane < 0) lane = lanes.indexOf(null);
    if (lane < 0) lane = lanes.length;
    positions.set(commit.id, {
      x: 11 + lane * 14,
      y: i * row + row / 2,
      color: colors[lane % colors.length]!,
    });
    lanes[lane] = commit.parent && !lanes.includes(commit.parent) ? commit.parent : null;
    if (commit.merge_parent && !lanes.includes(commit.merge_parent)) {
      const free = lanes.indexOf(null);
      lanes[free < 0 ? lanes.length : free] = commit.merge_parent;
    }
  }
  const width = Math.max(27, ...Array.from(positions.values(), (p) => p.x + 12));
  return (
    <div className="commit-scroll">
      <div className="commit-graph" style={{ gridTemplateColumns: `${width}px 1fr` }}>
        <svg aria-hidden="true" width={width} height={row * commits.length}>
          {commits.flatMap((commit) =>
            [commit.parent, commit.merge_parent].map((parent) => {
              const child = positions.get(commit.id)!;
              const end = parent ? positions.get(parent) : undefined;
              if (!end) return null;
              const mid = (child.y + end.y) / 2;
              return (
                <path
                  key={`${commit.id}-${parent}`}
                  stroke={end.color}
                  strokeWidth={2}
                  fill="none"
                  d={`M ${child.x} ${child.y} C ${child.x} ${mid}, ${end.x} ${mid}, ${end.x} ${end.y}`}
                />
              );
            }),
          )}
          {[...positions.entries()].map(([id, { x, y, color }]) => (
            <circle key={id} cx={x} cy={y} r={id === selected ? 5 : 3.6} fill={color} />
          ))}
        </svg>
        <div>
          {commits.map((commit) => (
            <button
              className="commit-row"
              key={commit.id}
              type="button"
              aria-pressed={commit.id === selected}
              onClick={() => choose(commit.id)}
            >
              <span>{commit.message}</span>
              {branches
                .filter((branch) => branch.head === commit.id)
                .map((branch) => (
                  <b key={branch.name}>{branch.name}</b>
                ))}
              <code>{commit.id.slice(0, 7)}</code>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
