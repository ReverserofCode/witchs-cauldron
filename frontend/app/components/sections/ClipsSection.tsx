import { SectionCard } from "@/app/components/cards";
import { getClipCatalog } from "@/app/lib/clips/catalog";
import ClipsCatalogClient from "./ClipsCatalogClient";

export default async function ClipsSection() {
  const initialCatalog = await getClipCatalog();

  return (
    <SectionCard
      tone="lavender"
      eyebrow="Shorts"
      title="하이라이트 숏폼"
      description="치지직 클립과 YouTube Shorts를 한눈에"
      bodyClassName="gap-3"
    >
      <ClipsCatalogClient initialCatalog={initialCatalog} />
    </SectionCard>
  );
}
