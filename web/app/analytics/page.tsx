import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let patterns;
  let locations;
  try {
    [patterns, locations] = await Promise.all([api.patterns(), api.locations()]);
  } catch (error) {
    if (error instanceof ApiError) {
      return (
        <>
          <PageHeader title="Charging Analytics" />
          <ApiErrorCard message={error.message} />
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <PageHeader
        title="Charging Analytics"
        description="Behaviour breakdowns by time of day, weekday, charger type, vehicle model and city. Bars share one scale; hover for exact values."
      />
      <AnalyticsView patterns={patterns} locations={locations} />
    </>
  );
}
