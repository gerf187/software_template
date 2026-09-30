export default function Message({ type = "hinweis", children }) {
  return <p className={`message message-${type}`}>{children}</p>;
}
