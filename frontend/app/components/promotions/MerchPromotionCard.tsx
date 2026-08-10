"use client";

import { SectionTracker } from "@/app/components/analytics/SectionTracker";
import { SectionCard } from "@/app/components/cards";
import { usePromotionCampaign } from "@/app/hooks/usePromotionCampaign";
import { SUMMER_ATELIER_CAMPAIGN } from "@/app/lib/promotions/summerAtelier";

export function MerchPromotionCard() {
  const runtime = usePromotionCampaign();
  if (runtime?.phase !== "active") return null;

  return (
    <SectionTracker sectionId="promotion-summer-atelier">
      <SectionCard
        as="div"
        eyebrow="Limited Pre-order"
        title={SUMMER_ATELIER_CAMPAIGN.title}
        description={SUMMER_ATELIER_CAMPAIGN.deadlineShort + "까지 팬텀픽에서 주문제작 예약 판매합니다."}
        className="border-sky-200/80 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.95),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(216,180,254,0.55),transparent_27%),linear-gradient(135deg,rgba(224,242,254,0.96),rgba(255,255,255,0.94)_48%,rgba(243,232,255,0.94))] shadow-[0_18px_44px_rgba(30,64,175,0.12)]"
      >
        <div
          data-promotion-id={SUMMER_ATELIER_CAMPAIGN.id}
          data-promotion-surface="card"
          className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
        >
          <div className="flex flex-col justify-between gap-4 rounded-[20px] border border-white/80 bg-white/72 p-4 shadow-sm">
            <div>
              <span className="inline-flex rounded-full bg-sky-700 px-3 py-1 text-xs font-bold text-white">
                PRE-ORDER
              </span>
              <p role="timer" className="mt-3 text-2xl font-black text-purple-950 sm:text-3xl">
                {runtime.countdownLabel}
              </p>
              <p className="mt-2 text-sm font-semibold text-purple-900/80">
                {SUMMER_ATELIER_CAMPAIGN.deadlineLong}
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/90 p-3">
              <p className="text-sm font-black text-sky-900">풀세트 구매 특전</p>
              <p className="mt-1 text-sm text-sky-950/85">
                풀세트 1개당 친필 사인 투명 포토카드 1장을 함께 증정합니다.
              </p>
            </div>

            <a
              href={SUMMER_ATELIER_CAMPAIGN.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary min-h-11 w-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 sm:w-fit"
              data-analytics-menu="true"
              data-analytics-id={SUMMER_ATELIER_CAMPAIGN.id + ":card"}
              data-analytics-label="팬텀픽에서 굿즈 보기"
              data-analytics-location="merch_promotion_card"
              data-analytics-type="promotion_cta"
            >
              팬텀픽에서 굿즈 보기
              <span className="sr-only"> 새 탭에서 열림</span>
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <ul className="grid gap-2 sm:grid-cols-2">
              {SUMMER_ATELIER_CAMPAIGN.products.map((product) => (
                <li
                  key={product.name}
                  className="rounded-2xl border border-purple-200/60 bg-white/80 px-3 py-3"
                >
                  <p className="break-keep text-sm font-bold text-purple-950">{product.name}</p>
                  <p className="mt-1 text-base font-black text-purple-700">{product.price}</p>
                  {"note" in product && product.note && (
                    <p className="mt-1 text-xs leading-5 text-purple-900/70">{product.note}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-purple-200/60 bg-white/65 px-3 py-3 text-xs leading-5 text-purple-950/75">
              <p className="font-bold text-purple-950">{SUMMER_ATELIER_CAMPAIGN.shippingDisplay}</p>
              <p>가격·판매 상태·배송 조건은 팬텀픽에서 최종 확인해 주세요.</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </SectionTracker>
  );
}
