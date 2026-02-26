export default function StatsCards({ stats }) {
  const items = [
    { label: "Total Projects", value: stats?.total_projects ?? "—" },
    { label: "Unique Clients", value: stats?.unique_clients ?? "—" },
    { label: "With Work Orders", value: stats?.projects_with_work_orders ?? "—" },
    { label: "With Invoices", value: stats?.projects_with_invoices ?? "—" },
  ];

  return (
    <div className="stats">
      {items.map((it) => (
        <div key={it.label} className="card">
          <div className="card-inner">
            <div className="subtle">{it.label}</div>
            <div className="stats__value">{it.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
