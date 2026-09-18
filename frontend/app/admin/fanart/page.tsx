import type { Metadata } from "next";
import FanArtAdmin from "./FanArtAdmin";

export const metadata: Metadata = { title: "팬아트 검수함 | 마녀의 포션 공방", robots: { index: false, follow: false } };
export default function FanArtAdminPage() { return <FanArtAdmin />; }
