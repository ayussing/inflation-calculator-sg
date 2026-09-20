import type { ReactNode } from "react";

export type DataTableColumn<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
};

export function DataTable<Row extends { id: string }>({
  columns,
  rows,
  footer,
}: {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  footer?: ReactNode[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-panel-border text-foreground/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2 font-medium ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-panel-border/60 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={`py-2 ${col.align === "right" ? "text-right" : "text-left"}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t border-panel-border font-medium">
              {footer.map((cell, i) => (
                <td
                  key={columns[i]?.key ?? i}
                  className={`py-2 ${columns[i]?.align === "right" ? "text-right" : "text-left"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
