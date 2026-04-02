import { Card, Skeleton } from "@breason/ui";

export default function Loading() {
  return (
    <div style={{ padding: 24, display: "grid", gap: 16 }}>
      <Card title="Loading Breason">
        <Skeleton height={20} />
      </Card>
    </div>
  );
}
