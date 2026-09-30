export default function PageHeader({ title, meta, actions }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="page-header-right">
        {meta && <span className="page-header-meta">{meta}</span>}
        {actions}
      </div>
    </div>
  );
}
