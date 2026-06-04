export default function Spinner({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-4 w-4" : size === "md" ? "h-6 w-6" : "h-8 w-8";
  return (
    <span
      className={`inline-block ${sizeClass} animate-spin rounded-full border-2 border-current border-t-transparent`}
      role="status"
      aria-label="Loading"
    />
  );
}
