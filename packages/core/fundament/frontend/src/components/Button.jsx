export default function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      className={`btn btn-${variant}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? `${children} …` : children}
    </button>
  );
}
