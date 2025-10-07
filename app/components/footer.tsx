// 하단 푸터: 저작권 및 크레딧 표기
export default function Footer() {
	return (
		<footer className="w-full border-t border-[rgba(219,206,247,0.6)]">
			<div className="container flex items-center justify-between py-8 text-xs text-muted">
				<p>© {new Date().getFullYear()} Witch's Cauldron</p>
				<p className="opacity-80">Powered by Moing palette</p>
			</div>
		</footer>
	)
}
