import { PageHeader } from "@/components/page-header";
import { ChargingForm } from "./charging-form";

export default function MyChargingPage() {
  return (
    <>
      <PageHeader
        title="My Charging"
        description="Enter your situation and get a charging plan: which charger, when to start, and the expected energy, time and cost. Estimates use charging physics; the trained models act as a sanity check."
      />
      <ChargingForm />
    </>
  );
}
