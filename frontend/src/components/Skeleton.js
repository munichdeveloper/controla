export function Skeleton({ className, ...props }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-soft ${className}`}
      {...props}
    />
  );
}

