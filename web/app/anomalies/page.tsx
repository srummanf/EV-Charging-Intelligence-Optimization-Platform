import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { AnomaliesTable } from "./anomalies-table";

export const dynamic = "force-dynamic";

export default async function AnomaliesPage() {
  let data;
  try {
    data = await api.anomalies({ limit: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Anomaly Monitor" />
          <ApiErrorCard message={error.message} />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Anomaly Monitor"
        description="Isolation Forest score (0–1) over physical-consistency features. Click a row for the rule-based explanation. The model is complementary to the hard rules, not a replacement."
      />
      <AnomaliesTable data={data} />
    </>
  );
}
