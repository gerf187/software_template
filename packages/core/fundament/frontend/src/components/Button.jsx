export default function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`btn btn-${variant}${className ? ` ${className}` : ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? `${children} …` : children}
    </button>
  );
}
