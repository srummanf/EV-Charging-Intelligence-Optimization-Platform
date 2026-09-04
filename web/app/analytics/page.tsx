import { api, ApiError } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ApiErrorCard } from "@/components/states";
import { Reveal } from "@/components/motion";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let patterns;
  let locations;
  let overview;
  try {
    [patterns, locations, overview] = await Promise.all([
      api.patterns(),
      api.locations(),
      api.overview(),
    ]);
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
        description="Behaviour broken down by time, weekday, charger, vehicle and city. Every breakdown shares one scale; switch the measure and hover for exact values."
      />
      <Reveal>
        <AnalyticsView
          patterns={patterns}
          locations={locations}
          overview={overview}
        />
      </Reveal>
    </>
  );
}
