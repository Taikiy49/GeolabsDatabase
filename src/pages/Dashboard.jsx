import { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import StatsCards from "../components/StatsCards";
import { apiGet } from "../api/client";

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    apiGet("/api/stats").then(setStats).catch(() => {});
  }, []);

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Overview of your reports/projects database"
      />
      <div className="page">
        <StatsCards stats={stats} />
        <div style={{ height: 6 }} />
        <div className="card">
          <div className="card-inner">
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Admin Notes</div>
            <div className="subtle">
              Use the Projects page to search, add, edit, and clean up entries. Keep date/PR/work order formats consistent for better matching.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
