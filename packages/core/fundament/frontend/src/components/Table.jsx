import { useMemo, useState } from "react";
import EmptyState from "./EmptyState.jsx";

export default function Table({
  columns,
  rows,
  rowKey,
  emptyText = "Keine Einträge gefunden.",
  onRowClick,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      const result = va > vb ? 1 : -1;
      return sortDir === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(col) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  }

  if (rows.length === 0) {
    return <EmptyState>{emptyText}</EmptyState>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={() => toggleSort(col)}
              className={col.sortable ? "table-sortable" : ""}
            >
              {col.label}
              {sortKey === col.key && (sortDir === "asc" ? " ▲" : " ▼")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr
            key={rowKey(row)}
            className={onRowClick ? "table-row-clickable" : ""}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <td key={col.key} data-label={col.label}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
