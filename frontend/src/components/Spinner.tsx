import { Icon } from "./Icon";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="loading">
      <Icon name="circle-notch" weight="bold" spin />
      {label ?? "Loading…"}
    </div>
  );
}
