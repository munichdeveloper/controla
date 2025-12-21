export function Skeleton({ className, ...props }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 dark:bg-zinc-800 ${className}`}
      {...props}
    />
  );
}

