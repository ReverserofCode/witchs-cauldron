export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
	return (
		<div className="container py-6">
			<h1 className="text-3xl font-extrabold md:text-4xl text-ink">{title}</h1>
			{subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
		</div>
	)
}
