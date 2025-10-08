// Broadcast schedule helper utilities
// - Pulls event rows from a Google Sheets document published as CSV ("Publish to web" -> CSV)
// - Parses the CSV into calendar-friendly JSON
// 구글 시트 주소 : https://docs.google.com/spreadsheets/d/1Gb0zwlzL-CGf9QP3iuY1oD-dhaUEowhUz4EFgTXg1I8/edit?pli=1&gid=250902752#gid=250902752

// 기본 방송 일정표는 공개 편집 링크만 알고 있어도 재생산할 수 있도록
// 시트 ID 및 gid(워크시트 탭)를 상수로 유지한다.
// - DEFAULT_SHEET_EDIT_URL은 구글 시트의 일반적인 편집 URL이다.
// - DEFAULT_SHEET_CSV_URL은 동일한 문서를 CSV export URL로 강제한 버전이다.
//   (실제로는 아래 normalizeGoogleSheetsUrl에서 재생성되므로 참고용)
const DEFAULT_SHEET_ID = '1Gb0zwlzL-CGf9QP3iuY1oD-dhaUEowhUz4EFgTXg1I8'
const DEFAULT_SHEET_GID = '250902752'
const DEFAULT_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/edit#gid=${DEFAULT_SHEET_GID}`
const DEFAULT_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/export?format=csv&gid=${DEFAULT_SHEET_GID}`

export type ScheduleSourceType = 'env' | 'default'

export interface ScheduleSourceInfo {
	source: ScheduleSourceType
	originUrl: string
	csvUrl: string
	sheetId?: string
	gid?: string
	wasConverted: boolean
	notes: string[]
}

interface NormalizedSheetUrl {
	csvUrl: string
	sheetId?: string
	gid?: string
	wasConverted: boolean
	notes: string[]
}

export interface ScheduleEvent {
	id: string
	title: string
	start: string
	end?: string
	platform?: string
	description?: string
	raw?: Record<string, string>
}

export interface ScheduleFeed {
	source: 'google-sheets-csv'
	csvUrl: string
	fetchedAt: string
	events: ScheduleEvent[]
	rows: SheetRow[]
	rawRows: string[][]
	sourceInfo?: ScheduleSourceInfo
}

export interface FetchScheduleOptions {
	/**
	 * ISR window (seconds). When omitted we disable caching to always fetch the latest sheet.
	 */
	revalidate?: number
}

export interface DiagnosticStep {
	id: string
	label: string
	status: 'ok' | 'failed'
	startedAt: string
	finishedAt: string
	durationMs: number
	metadata?: Record<string, unknown>
	error?: string
}

export interface ScheduleDiagnostics {
	ok: boolean
	steps: DiagnosticStep[]
	feed?: ScheduleFeed
	errorMessage?: string
	errorStatus?: number
}

/**
 * 방송 일정 CSV의 최종 URL을 계산한다.
 *
 * 1. 환경 변수가 주어지면 이를 우선 사용하고, 구글 시트 URL이라면 CSV export 형태로 정규화한다.
 * 2. 환경 변수가 비어 있으면 기본 시트(DEFAULT_SHEET_*)를 사용한다.
 * 3. 추가 진단을 위해 원본 URL, 변환 여부, 참고 메모를 반환한다.
 */
export function resolveScheduleSource(rawUrl?: string): ScheduleSourceInfo {
	const trimmed = rawUrl?.trim()
	if (trimmed) {
		const normalized = normalizeGoogleSheetsUrl(trimmed)
		return {
			source: 'env',
			originUrl: trimmed,
			csvUrl: normalized.csvUrl,
			sheetId: normalized.sheetId,
			gid: normalized.gid,
			wasConverted: normalized.wasConverted,
			notes: normalized.notes,
		}
	}

	const normalizedDefault = normalizeGoogleSheetsUrl(DEFAULT_SHEET_EDIT_URL)
	const notes = ['used-default-fallback', ...normalizedDefault.notes]

	return {
		source: 'default',
		originUrl: DEFAULT_SHEET_EDIT_URL,
		csvUrl: normalizedDefault.csvUrl || DEFAULT_SHEET_CSV_URL,
		sheetId: normalizedDefault.sheetId ?? DEFAULT_SHEET_ID,
		gid: normalizedDefault.gid ?? DEFAULT_SHEET_GID,
		wasConverted: normalizedDefault.wasConverted,
		notes,
	}
}

/**
 * 구글 시트 공유 링크(편집/미리보기/Export)를 CSV export URL로 통일한다.
 *
 * 변환 규칙
 * - docs.google.com이 아니면 그대로 반환한다.
 * - 이미 /export?format=csv 형태면 그대로 두고 메모만 추가한다.
 * - 편집 URL(/edit, /view 등)은 /export?format=csv로 변경하고 gid를 그대로 전파한다.
 * - gid 정보가 search 혹은 hash에 없으면 undefined로 두지만 URL 자체는 유효하다.
 *
 * 반환값에는 추후 진단에서 활용할 수 있도록 변환 단계에 대한 notes가 포함된다.
 */
function normalizeGoogleSheetsUrl(url: string): NormalizedSheetUrl {
	const notes: string[] = []
	try {
		const parsed = new URL(url)
		const isGoogleSheets = parsed.hostname.includes('docs.google.com') && parsed.pathname.includes('/spreadsheets/')
		if (!isGoogleSheets) {
			notes.push('non-google-sheets-url')
			return { csvUrl: url, wasConverted: false, notes }
		}

		// 구글 시트 편집 URL은 /d/<sheetId>/ 형태를 가진다. 여기서 시트 ID를 추출한다.
		const sheetIdMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9-_]+)/)
		const sheetId = sheetIdMatch?.[1]
		let gid = parsed.searchParams.get('gid') ?? undefined
		if (!gid && parsed.hash) {
			// 일부 공유 링크는 #gid= 으로 워크시트 탭을 전달하므로 hash에서도 탐색한다.
			const hashMatch = parsed.hash.match(/gid=([0-9]+)/)
			if (hashMatch) {
				gid = hashMatch[1]
			}
		}

		if (parsed.pathname.includes('/export')) {
			const format = parsed.searchParams.get('format')
			if (format?.toLowerCase() === 'csv') {
				notes.push('already-export-csv')
				return {
					csvUrl: parsed.toString(),
					sheetId,
					gid,
					wasConverted: false,
					notes,
				}
			}
			// /export 이지만 다른 포맷이라면 format=csv로 덮어써 준다.
			parsed.searchParams.set('format', 'csv')
			notes.push('export-format-adjusted')
			return {
				csvUrl: parsed.toString(),
				sheetId,
				gid,
				wasConverted: true,
				notes,
			}
		}

		if (!sheetId) {
			notes.push('missing-sheet-id')
			return { csvUrl: url, wasConverted: false, notes }
		}

		// 편집 링크를 /export?format=csv 로 바꾸어 fetch가 바로 CSV를 받도록 한다.
		const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`)
		exportUrl.searchParams.set('format', 'csv')
		if (gid) {
			exportUrl.searchParams.set('gid', gid)
		}
		notes.push('converted-from-edit-url')
		return {
			csvUrl: exportUrl.toString(),
			sheetId,
			gid,
			wasConverted: true,
			notes,
		}
	} catch {
		notes.push('url-parse-error')
	}

	return { csvUrl: url, wasConverted: false, notes }
}

export class ScheduleSourceError extends Error {
	readonly status: number

	constructor(message: string, options?: { cause?: unknown; status?: number }) {
		super(message)
		this.name = 'ScheduleSourceError'
		this.status = options?.status ?? 500
			if (options?.cause !== undefined) {
				;(this as { cause?: unknown }).cause = options.cause
		}
	}
}

type SheetRow = Record<string, string>

/**
 * Fetch and parse a published Google Sheets CSV into a calendar-ready payload.
 *
 * 인자로 명시한 URL이 없으면 `resolveScheduleSource`가 기본 시트를 사용한다.
 * 환경 변수가 편집 URL이라도 `normalizeGoogleSheetsUrl`이 CSV export 링크로 바꾼다.
 *
 * @param csvUrl `BROADCAST_SCHEDULE_CSV_URL` 등으로 전달된 원본 URL(선택)
 * @param options Optional revalidation window for Next.js fetch caching
 */
export async function fetchScheduleFromPublishedCsv(
	csvUrl?: string,
	options: FetchScheduleOptions = {}
): Promise<ScheduleFeed> {
	const sourceInfo = resolveScheduleSource(csvUrl)
	const effectiveUrl = sourceInfo.csvUrl
	if (!effectiveUrl) {
		throw new ScheduleSourceError('유효한 CSV URL을 결정할 수 없습니다.', {
			status: 500,
		})
	}

	const requestInit: RequestInit & { next?: { revalidate?: number } } = {}

	if (typeof options.revalidate === 'number') {
		requestInit.next = { revalidate: options.revalidate }
	} else {
		requestInit.cache = 'no-store'
	}

	let response: Response
	try {
		response = await fetch(effectiveUrl, requestInit)
	} catch (cause) {
		throw new ScheduleSourceError('Failed to reach the published CSV source.', {
			cause,
			status: 502,
		})
	}

	if (!response.ok) {
		throw new ScheduleSourceError(
			`Published CSV responded with ${response.status} ${response.statusText}.`,
			{ status: 502 }
		)
	}

	const csvText = stripBom(await response.text())
	const rawRows = parseCsv(csvText)
	const parsedRows = rowsToObjects(rawRows)
	const events = buildEvents(parsedRows, rawRows)

	return {
		source: 'google-sheets-csv',
		csvUrl: effectiveUrl,
		fetchedAt: new Date().toISOString(),
		events,
		rows: parsedRows,
		rawRows,
		sourceInfo,
	}
}

/**
 * 진단 모드: 일정 CSV 파이프라인의 각 단계를 실행하고 결과를 기록한다.
 *
 * 이 함수 역시 입력 URL이 비어 있어도 기본 시트를 대상으로 동작한다.
 * 각 단계는 성공/실패 여부와 메타데이터(예: 노출된 CSV URL)를 포함하여 반환한다.
 */
export async function diagnoseSchedule(
	csvUrl?: string,
	options: FetchScheduleOptions = {}
): Promise<ScheduleDiagnostics> {
	const diagnostics: ScheduleDiagnostics = {
		ok: false,
		steps: [],
	}

	const steps = diagnostics.steps
	let rawText = ''
	let rawRows: string[][] = []
	let parsedRows: SheetRow[] = []
	let events: ScheduleEvent[] = []

	const sourceInfo = resolveScheduleSource(csvUrl)
	const effectiveCsvUrl = sourceInfo.csvUrl

	async function runStep<T>(
		id: string,
		label: string,
		executor: () => Promise<T> | T
	): Promise<T> {
		const startedAt = new Date()
		const step: DiagnosticStep = {
			id,
			label,
			status: 'ok',
			startedAt: startedAt.toISOString(),
			finishedAt: startedAt.toISOString(),
			durationMs: 0,
		}
		steps.push(step)

		const startTime = Date.now()
		try {
			const result = await executor()
			const finishedAt = new Date()
			step.finishedAt = finishedAt.toISOString()
			step.durationMs = Date.now() - startTime
			if (result !== undefined) {
				step.metadata = normalizeMetadata(result)
			}
			return result
		} catch (error) {
			const finishedAt = new Date()
			step.finishedAt = finishedAt.toISOString()
			step.durationMs = Date.now() - startTime
			step.status = 'failed'
			if (error instanceof ScheduleSourceError) {
				step.error = error.message
				const causeValue = (error as { cause?: unknown }).cause
				step.metadata = {
					status: error.status,
					cause: causeValue ? serializeCause(causeValue) : undefined,
				}
			} else if (error instanceof Error) {
				step.error = error.message
			} else {
				step.error = 'Unknown error'
			}
			throw error
		}
	}

	const requestInit: RequestInit & { next?: { revalidate?: number } } = {}
	if (typeof options.revalidate === 'number') {
		requestInit.next = { revalidate: options.revalidate }
	} else {
		requestInit.cache = 'no-store'
	}

	try {
		await runStep('resolve-source', '원본 URL 정규화', () => ({
			source: sourceInfo.source,
			originUrl: sourceInfo.originUrl,
			csvUrl: sourceInfo.csvUrl,
			sheetId: sourceInfo.sheetId,
			gid: sourceInfo.gid,
			wasConverted: sourceInfo.wasConverted,
			notes: sourceInfo.notes,
		}))

		await runStep('parse-url', 'CSV URL 구문 분석', () => {
			const parsed = new URL(effectiveCsvUrl)
			return {
				host: parsed.host,
				pathname: parsed.pathname,
			}
		})

		await runStep('fetch-csv', 'CSV 다운로드', async () => {
			let response: Response
			try {
				response = await fetch(effectiveCsvUrl, requestInit)
			} catch (cause) {
				throw new ScheduleSourceError('CSV 주소에 접근할 수 없습니다.', {
					cause,
					status: 502,
				})
			}

			if (!response.ok) {
				throw new ScheduleSourceError(
					`CSV 응답이 실패했습니다. status=${response.status}`,
					{ status: response.status }
				)
			}

			rawText = stripBom(await response.text())
			return {
				status: response.status,
				contentType: response.headers.get('content-type') ?? 'unknown',
				bytes: rawText.length,
				url: effectiveCsvUrl,
			}
		})

		await runStep('parse-csv', 'CSV 행 파싱', () => {
			rawRows = parseCsv(rawText)
			return {
				totalRows: rawRows.length,
				sample: rawRows.slice(0, 3),
			}
		})

		await runStep('normalize-rows', '헤더 정규화', () => {
			parsedRows = rowsToObjects(rawRows)
			return {
				totalRecords: parsedRows.length,
				headerKeys: Object.keys(parsedRows[0] ?? {}),
			}
		})

		await runStep('build-events', '이벤트 생성', () => {
			events = buildEvents(parsedRows, rawRows)
			return {
				totalEvents: events.length,
				eventSample: events.slice(0, 3).map((event) => ({
					title: event.title,
					start: event.start,
					end: event.end,
				})),
			}
		})

		diagnostics.ok = true
		diagnostics.feed = {
			source: 'google-sheets-csv',
			csvUrl: effectiveCsvUrl,
			fetchedAt: new Date().toISOString(),
			events,
			rows: parsedRows,
			rawRows,
			sourceInfo,
		}
	} catch (error) {
		diagnostics.ok = false
		if (error instanceof ScheduleSourceError) {
			diagnostics.errorMessage = error.message
			diagnostics.errorStatus = error.status
		} else if (error instanceof Error) {
			diagnostics.errorMessage = error.message
		} else {
			diagnostics.errorMessage = '알 수 없는 오류가 발생했습니다.'
		}
	}

	return diagnostics
}

function buildEvents(rows: SheetRow[], rawRows: string[][]): ScheduleEvent[] {
	const listFromFlatRows = rows
		.map((row, index) => createEventFromRow(row, index))
		.filter((event): event is ScheduleEvent => Boolean(event))

	if (listFromFlatRows.length > 0) {
		return listFromFlatRows
	}

	return buildEventsFromMatrix(rawRows)
}

function createEventFromRow(row: SheetRow, index: number): ScheduleEvent | null {
	const lookup = createLookup(row)
	const dateValue = pickValue(row, lookup, ['date', '날짜'])
	const startTime = pickValue(row, lookup, ['start', 'starttime', '시작', '시간'])
	const endTime = pickValue(row, lookup, ['end', 'endtime', '종료', '끝'])
	const title = pickValue(row, lookup, ['title', '제목', '방송명', 'event']) ?? `Event ${index + 1}`
	const description = pickValue(row, lookup, ['description', '설명', '비고', '메모'])
	const platform = pickValue(row, lookup, ['platform', '플랫폼', '채널', 'service'])

	const startIso = parseDateTime(dateValue, startTime)
	if (!startIso) {
		return null
	}

	const endIso = parseDateTime(dateValue, endTime) ?? undefined

	const event: ScheduleEvent = {
		id: createEventId(startIso, title, index),
		title,
		start: startIso,
		raw: row,
	}

	if (endIso && endIso !== startIso) {
		event.end = endIso
	}

	if (platform) {
		event.platform = platform
	}

	if (description) {
		event.description = description
	}

	return event
}

interface ColumnDate {
	label: string
	year: number
	month: number
	day: number
	isoDate: string
}

interface DateContext {
	currentYear: number
	lastMonth: number
}

interface HeaderParseResult {
	hasHeader: boolean
	columnDates: Array<ColumnDate | undefined>
	context: DateContext
}

interface TimeRangeResult {
	startHour: number
	startMinute: number
	endHour?: number
	endMinute?: number
}

function buildEventsFromMatrix(rows: string[][]): ScheduleEvent[] {
	const events: ScheduleEvent[] = []
	if (!rows.length) {
		return events
	}

	const baseYear = inferBaseYear(rows) ?? new Date().getFullYear()
	let context: DateContext = { currentYear: baseYear, lastMonth: 0 }
	let columnDates: Array<ColumnDate | undefined> = []
	const pending = new Map<number, string[]>()

	const flushColumn = (columnIndex: number) => {
		const dateInfo = columnDates[columnIndex]
		const lines = pending.get(columnIndex)
		if (!dateInfo || !lines || lines.every((line) => line.trim().length === 0)) {
			pending.delete(columnIndex)
			return
		}
		pending.delete(columnIndex)
		const sanitized = lines.map((line) => line.trim()).filter(Boolean)
		if (!sanitized.length) {
			return
		}
		const event = createEventFromLines(dateInfo, sanitized, events.length)
		if (event) {
			events.push(event)
		}
	}

	const flushAll = () => {
		Array.from(pending.keys()).forEach(flushColumn)
	}

	rows.forEach((row) => {
		const trimmed = row.map((cell) => (cell ?? '').trim())
		const headerResult = parseDateHeaderRow(trimmed, context)
		if (headerResult?.hasHeader) {
			flushAll()
			columnDates = headerResult.columnDates
			context = headerResult.context
			return
		}

		const rowHasContent = trimmed.some((cell) => cell.length > 0)
		if (!rowHasContent) {
			flushAll()
			return
		}

		trimmed.forEach((cell, columnIndex) => {
			const dateInfo = columnDates[columnIndex]
			if (!dateInfo) {
				return
			}
			if (cell.length > 0) {
				const bucket = pending.get(columnIndex) ?? []
				bucket.push(cell)
				pending.set(columnIndex, bucket)
			} else if (pending.has(columnIndex)) {
				flushColumn(columnIndex)
			}
		})
	})

	flushAll()

	return events
}

function parseDateHeaderRow(row: string[], context: DateContext): HeaderParseResult | null {
	const columnDates: Array<ColumnDate | undefined> = []
	let headerCount = 0
	let workingContext = { ...context }

	row.forEach((cell, columnIndex) => {
		const result = parseDateHeaderCell(cell, workingContext)
		if (result) {
			columnDates[columnIndex] = result.date
			workingContext = result.context
			headerCount += 1
		} else {
			columnDates[columnIndex] = undefined
		}
	})

	if (headerCount >= 2) {
		return {
			hasHeader: true,
			columnDates,
			context: workingContext,
		}
	}

	return null
}

function parseDateHeaderCell(cell: string, context: DateContext): { date: ColumnDate; context: DateContext } | null {
	const trimmed = cell.trim()
	if (!trimmed) {
		return null
	}
	if (/weekly/i.test(trimmed) || /to\s*do/i.test(trimmed)) {
		return null
	}

	const explicitMatch = trimmed.match(/^['’`]?([0-9]{2,4})\s*\/\s*([0-9]{1,2})\s*\/\s*([0-9]{1,2})/)
	let year = context.currentYear
	let month: number | undefined
	let day: number | undefined

	if (explicitMatch) {
		const rawYear = parseInt(explicitMatch[1], 10)
		month = parseInt(explicitMatch[2], 10)
		day = parseInt(explicitMatch[3], 10)
		year = rawYear >= 100 ? rawYear : 2000 + rawYear
	} else {
		const match = trimmed.match(/([0-9]{1,2})\s*\/\s*([0-9]{1,2})/)
		if (!match) {
			return null
		}
		month = parseInt(match[1], 10)
		day = parseInt(match[2], 10)
		if (context.lastMonth > 0 && month < context.lastMonth) {
			year = context.currentYear + 1
		}
	}

	if (!month || !day) {
		return null
	}

	const updatedContext: DateContext = { currentYear: year, lastMonth: month }
	return {
		date: {
			label: trimmed,
			year,
			month,
			day,
			isoDate: formatIsoDate(year, month, day),
		},
		context: updatedContext,
	}
}

function createEventFromLines(
	date: ColumnDate,
	lines: string[],
	index: number
): ScheduleEvent | null {
	if (!lines.length) {
		return null
	}

	const { time, details } = extractTimeFromLines(lines)
	const cleanedDetails = details.map((line) => line.trim()).filter(Boolean)
	const title = cleanedDetails[0] ?? `${date.label} 방송`
	const description = cleanedDetails.slice(1).join('\n').trim() || undefined
	const platform = detectPlatform([title, ...cleanedDetails.slice(1)].join(' '))
	const startIso = time
		? formatIsoDateTime(date.year, date.month, date.day, time.startHour, time.startMinute)
		: formatIsoDateTime(date.year, date.month, date.day, 0, 0)
	let endIso: string | undefined
	if (time && time.endHour !== undefined) {
		const endMinute = time.endMinute ?? 0
		endIso = formatIsoDateTime(date.year, date.month, date.day, time.endHour, endMinute)
	}

	const raw: Record<string, string> = { date: date.isoDate }
	cleanedDetails.forEach((value, detailIndex) => {
		raw[`detail_${detailIndex + 1}`] = value
	})
	if (time) {
		const startHour = time.startHour.toString().padStart(2, '0')
		const startMinute = time.startMinute.toString().padStart(2, '0')
		raw.time = `${startHour}:${startMinute}`
		if (time.endHour !== undefined) {
			const endHour = time.endHour.toString().padStart(2, '0')
			const endMinute = (time.endMinute ?? 0).toString().padStart(2, '0')
			raw.timeRange = `${startHour}:${startMinute}~${endHour}:${endMinute}`
		}
	}

	return {
		id: createEventId(startIso, title, index),
		title,
		start: startIso,
		...(endIso ? { end: endIso } : {}),
		...(platform ? { platform } : {}),
		...(description ? { description } : {}),
		raw,
	}
}

function extractTimeFromLines(lines: string[]): { time?: TimeRangeResult; details: string[] } {
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i]
		const { time, remainder } = parseTimeExpression(line)
		if (time) {
			const details = [] as string[]
			if (remainder) {
				details.push(remainder)
			}
			lines.forEach((value, idx) => {
				if (idx !== i) {
					details.push(value)
				}
			})
			return { time, details }
		}
	}

	const combined = lines.join(' ')
	const { time, remainder } = parseTimeExpression(combined)
	if (time) {
		const details = remainder ? [remainder] : []
		return { time, details }
	}

	return { details: lines }
}

function parseTimeExpression(input: string): { time?: TimeRangeResult; remainder: string } {
	const timeRangeRegex =
		/(?:(오전|오후|AM|PM)\s*)?(\d{1,2})(?:[:시]\s*(\d{1,2}))?\s*(?:분)?\s*(?:[-~–]\s*(?:(오전|오후|AM|PM)\s*)?(\d{1,2})(?:[:시]\s*(\d{1,2}))?\s*(?:분)?)?/
	const match = timeRangeRegex.exec(input)
	if (!match) {
		return { remainder: input.trim() }
	}

	const [, startMeridiem, startHourRaw, startMinuteRaw, endMeridiem, endHourRaw, endMinuteRaw] = match
	const startHour = parseInt(startHourRaw, 10)
	const startMinute = startMinuteRaw ? parseInt(startMinuteRaw, 10) : 0
	const { hour: normalizedStartHour, minute: normalizedStartMinute } = applyMeridiem(
		startHour,
		startMinute,
		startMeridiem
	)

	let endHour: number | undefined
	let endMinute: number | undefined
	if (endHourRaw) {
		const parsedEndHour = parseInt(endHourRaw, 10)
		const parsedEndMinute = endMinuteRaw ? parseInt(endMinuteRaw, 10) : 0
		const normalized = applyMeridiem(parsedEndHour, parsedEndMinute, endMeridiem ?? startMeridiem)
		endHour = normalized.hour
		endMinute = normalized.minute
	}

	const remainder = input.replace(match[0], '').trim()
	return {
		time: {
			startHour: normalizedStartHour,
			startMinute: normalizedStartMinute,
			endHour,
			endMinute,
		},
		remainder,
	}
}

function applyMeridiem(hour: number, minute: number, meridiem?: string | null): { hour: number; minute: number } {
	if (!meridiem) {
		return { hour: hour % 24, minute }
	}
	const marker = meridiem.toLowerCase()
	const isPm = marker.includes('pm') || marker.includes('오후')
	const isAm = marker.includes('am') || marker.includes('오전')
	let adjusted = hour % 12
	if (isPm) {
		adjusted += 12
	}
	if (isAm && adjusted === 12) {
		adjusted = 0
	}
	return { hour: adjusted, minute }
}

function detectPlatform(text: string): string | undefined {
	const lower = text.toLowerCase()
	if (/치지직|줍소|chzzk/.test(lower)) {
		return 'CHZZK'
	}
	if (/유튜브|youtube/.test(lower)) {
		return 'YouTube'
	}
	if (/트위치|twitch/.test(lower)) {
		return 'Twitch'
	}
	return undefined
}

function inferBaseYear(rows: string[][]): number | undefined {
	for (const row of rows) {
		for (const cell of row) {
			const trimmed = cell?.trim()
			if (!trimmed) {
				continue
			}
			const explicitYear = trimmed.match(/(20\d{2})\s*년/)
			if (explicitYear) {
				return parseInt(explicitYear[1], 10)
			}
			const shortYear = trimmed.match(/'\s*(\d{2})\s*\/\s*\d{1,2}\s*\/\s*\d{1,2}/)
			if (shortYear) {
				return 2000 + parseInt(shortYear[1], 10)
			}
		}
	}
	return undefined
}

function formatIsoDate(year: number, month: number, day: number): string {
	return formatIsoDateTime(year, month, day, 0, 0)
}

function formatIsoDateTime(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number
): string {
	const pad = (value: number) => value.toString().padStart(2, '0')
	return `${year.toString().padStart(4, '0')}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
	if (value === undefined || value === null) {
		return undefined
	}

	if (Array.isArray(value)) {
		return { items: value }
	}

	if (typeof value === 'object') {
		return value as Record<string, unknown>
	}

	return { value }
}

function serializeCause(cause: unknown): string {
	if (cause instanceof Error) {
		return `${cause.name}: ${cause.message}`
	}

	if (typeof cause === 'string') {
		return cause
	}

	if (typeof cause === 'object') {
		try {
			return JSON.stringify(cause)
		} catch {
			return Object.prototype.toString.call(cause)
		}
	}

	return String(cause)
}
function parseCsv(input: string): string[][] {
	const rows: string[][] = []
	let currentField = ''
	let currentRow: string[] = []
	let insideQuotes = false
	for (let i = 0; i < input.length; i += 1) {
		const char = input[i]
		const nextChar = input[i + 1]

		if (char === '"') {
			if (insideQuotes && nextChar === '"') {
				currentField += '"'
				i += 1
			} else {
				insideQuotes = !insideQuotes
			}
			continue
		}

		if (!insideQuotes && (char === '\n' || char === '\r')) {
			if (char === '\r' && nextChar === '\n') {
				i += 1
			}
			currentRow.push(currentField)
			rows.push(currentRow)
			currentField = ''
			currentRow = []
			continue
		}

		if (!insideQuotes && char === ',') {
			currentRow.push(currentField)
			currentField = ''
			continue
		}

		currentField += char
	}

	if (currentField.length > 0 || currentRow.length > 0) {
		currentRow.push(currentField)
		rows.push(currentRow)
	}

	return rows
}

function rowsToObjects(rows: string[][]): SheetRow[] {
	if (!rows.length) {
		return []
	}

	const [headerRow, ...dataRows] = rows
	const normalizedHeaders = createHeaderKeys(headerRow)

	return dataRows
		.map((row) => {
			const record: SheetRow = {}
			normalizedHeaders.forEach((header, index) => {
				record[header] = row[index]?.trim() ?? ''
			})
			return record
		})
		.filter((record) => Object.values(record).some((value) => value.length > 0))
}

function createHeaderKeys(headerRow: string[]): string[] {
	const seen = new Map<string, number>()

	return headerRow.map((header, index) => {
		const baseKey = (header?.trim() || `column_${index + 1}`).replace(/\s+/g, ' ')
		const count = seen.get(baseKey) ?? 0
		seen.set(baseKey, count + 1)
		if (count === 0) {
			return baseKey
		}
		return `${baseKey}_${count + 1}`
	})
}

function createLookup(row: SheetRow): Map<string, string> {
	const lookup = new Map<string, string>()
	Object.entries(row).forEach(([key, value]) => {
		const normalized = normalizeKey(key)
		if (!lookup.has(normalized) && value) {
			lookup.set(normalized, value.trim())
		}
	})
	return lookup
}

function pickValue(row: SheetRow, lookup: Map<string, string>, candidates: string[]): string | undefined {
	for (const candidate of candidates) {
		const direct = row[candidate]
		if (direct && direct.trim()) {
			return direct.trim()
		}

		const normalized = lookup.get(normalizeKey(candidate))
		if (normalized && normalized.trim()) {
			return normalized.trim()
		}
	}

	return undefined
}

function parseDateTime(dateValue?: string, timeValue?: string): string | undefined {
	if (!dateValue) {
		return undefined
	}

	const normalizedDate = normalizeDate(dateValue)
	const normalizedTime = normalizeTime(timeValue)

	if (!normalizedDate) {
		return undefined
	}

	const dateTimeVariants = normalizedTime.length
		? [
				`${normalizedDate} ${normalizedTime}`,
				`${normalizedDate}T${normalizedTime}`,
			]
		: [`${normalizedDate}`, `${normalizedDate}T00:00:00`]

	for (const variant of dateTimeVariants) {
		const iso = toIsoString(variant)
		if (iso) {
			return iso
		}
	}

	return undefined
}

function normalizeDate(value: string): string {
	return value
		.trim()
		.replace(/년|\//g, '-')
		.replace(/월/g, '-')
		.replace(/일/g, '')
		.replace(/\.+/g, (match) => '-'.repeat(match.length))
		.replace(/\s+/g, '-')
		.replace(/--+/g, '-')
		.replace(/-$/g, '')
}

function normalizeTime(value?: string): string {
	if (!value) {
		return ''
	}

	let time = value.trim()
	if (!time) {
		return ''
	}

	// Convert Korean AM/PM markers to English for Date parsing compatibility
	time = time
		.replace(/오전\s*/i, 'AM ')
		.replace(/오후\s*/i, 'PM ')
		.replace(/[시]/g, ':')
		.replace(/분/g, '')
		.replace(/[\s]+/g, ' ')

	const isoCandidate = toIsoString(`1970-01-01 ${time}`)
	if (isoCandidate) {
		return time
	}

	const match = time.match(/^(\d{1,2})(?:[:시]\s*(\d{1,2}))?/)
	if (match) {
		const hours = match[1].padStart(2, '0')
		const minutes = (match[2] ?? '00').padStart(2, '0')
		return `${hours}:${minutes}:00`
	}

	return time
}

function toIsoString(input: string): string | undefined {
	const date = new Date(input)
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function normalizeKey(input: string): string {
	return input.toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
}

function createEventId(startIso: string, title: string, index: number): string {
	const slug = title
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9가-힣]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.toLowerCase()

	return `${startIso}-${slug || 'event'}-${index}`
}

function stripBom(value: string): string {
	if (value.charCodeAt(0) === 0xfeff) {
		return value.slice(1)
	}
	return value
}