"use client";

import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import type { ScheduleEvent } from "@/app/api/broadCastSchedule/schedule";

interface ScheduleModalProps {
  events: ScheduleEvent[];
  isOpen: boolean;
  onClose: () => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: ScheduleEvent[];
}

export default function ScheduleModal({
  events,
  isOpen,
  onClose,
}: ScheduleModalProps): ReactElement | null {
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
      } else if (e.key === "ArrowRight") {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      }
    },
    [onClose]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const calendarDays = useMemo(() => {
    return buildCalendarDays(currentMonth, events);
  }, [currentMonth, events]);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
    }).format(currentMonth);
  }, [currentMonth]);

  const monthLabelMobile = useMemo(() => {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
    }).format(currentMonth);
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="전체 일정 보기"
    >
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[95vh] bg-white/95 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
              Schedule
            </span>
            <h2 className="text-lg font-bold text-purple-900" aria-label={monthLabel}>
              <span className="sm:hidden">{monthLabelMobile}</span>
              <span className="hidden sm:inline">{monthLabel}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold text-purple-700 transition-all duration-200 rounded-lg hover:bg-purple-100 active:scale-95"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex items-center justify-center w-8 h-8 transition-all duration-200 rounded-full hover:bg-purple-100 hover:scale-110 active:scale-95"
              aria-label="이전 달"
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex items-center justify-center w-8 h-8 transition-all duration-200 rounded-full hover:bg-purple-100 hover:scale-110 active:scale-95"
              aria-label="다음 달"
            >
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 ml-2 transition-all duration-200 rounded-full hover:bg-purple-100 hover:scale-110 active:scale-95"
              aria-label="닫기"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto overflow-x-hidden">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="w-16 h-16 mb-4 text-purple-300">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-purple-800">등록된 일정이 없습니다</p>
              <p className="mt-1 text-sm text-purple-600">일정 데이터를 불러오지 못했거나 등록된 일정이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* Mobile: Agenda List View */}
              <div className="sm:hidden">
                <AgendaView days={calendarDays} />
              </div>

              {/* Desktop: Calendar Grid */}
              <div className="hidden sm:block">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
                    <div
                      key={day}
                      className={`py-2 text-xs font-semibold text-center ${
                        index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : "text-purple-700"
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <CalendarDayCell key={index} day={day} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-xs border-t border-purple-100 bg-purple-50/50 text-purple-700">
          <span>방향키로 월 이동, ESC로 닫기</span>
          <span>
            전체 일정: {events.length}개 | 이번 달: {events.filter((e) => isEventInMonth(e, currentMonth)).length}개
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CalendarDayCell({ day }: { day: CalendarDay }) {
  const dateLabel = day.date.getDate();

  return (
    <div
      className={`relative min-h-[100px] p-2 rounded-lg border transition-all duration-200 ${
        day.isCurrentMonth
          ? day.isToday
            ? "border-purple-400 bg-purple-100/80 hover:bg-purple-100"
            : day.isWeekend
            ? "border-purple-200/60 bg-purple-50/50 hover:bg-purple-50/80 hover:border-purple-200"
            : "border-purple-100/60 bg-white/80 hover:bg-purple-50/40 hover:border-purple-200/80"
          : "border-transparent bg-gray-50/50"
      } ${day.events.length > 0 ? "hover:shadow-md cursor-default" : ""}`}
    >
      {/* Date Number */}
      <div
        className={`text-sm font-semibold mb-1 ${
          !day.isCurrentMonth
            ? "text-gray-300"
            : day.isToday
            ? "text-purple-900"
            : day.date.getDay() === 0
            ? "text-red-500"
            : day.date.getDay() === 6
            ? "text-blue-500"
            : "text-purple-800"
        }`}
      >
        {dateLabel}
        {day.isToday && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold text-white bg-purple-600 rounded">
            오늘
          </span>
        )}
      </div>

      {/* Events */}
      <div className="flex flex-col gap-0.5">
        {day.events.slice(0, 3).map((event) => (
          <div
            key={event.id}
            className="px-1 py-0.5 text-xs font-medium text-purple-900 truncate bg-purple-200/60 rounded"
            title={`${event.title} - ${formatEventTime(event.start)}`}
          >
            {formatEventTime(event.start)} {event.title}
          </div>
        ))}
        {day.events.length > 3 && (
          <div className="px-1 py-0.5 text-[10px] font-medium text-purple-600">
            +{day.events.length - 3}개 더
          </div>
        )}
      </div>
    </div>
  );
}

function AgendaView({ days }: { days: CalendarDay[] }) {
  const daysWithEvents = days.filter((day) => day.isCurrentMonth && day.events.length > 0);
  const daysWithoutEvents = days.filter((day) => day.isCurrentMonth && day.events.length === 0);

  const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });

  if (daysWithEvents.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-sm font-semibold text-purple-800">이번 달에는 예정된 방송이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {daysWithEvents.map((day) => (
        <div
          key={formatDateKey(day.date)}
          className={`rounded-xl border p-3 ${
            day.isToday
              ? "border-purple-400 bg-purple-100/80"
              : "border-purple-100 bg-white/80"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-sm font-bold ${
                day.isToday
                  ? "text-purple-900"
                  : day.date.getDay() === 0
                  ? "text-red-500"
                  : day.date.getDay() === 6
                  ? "text-blue-500"
                  : "text-purple-800"
              }`}
            >
              {dateFormatter.format(day.date)}
            </span>
            {day.isToday && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-purple-600 rounded">
                오늘
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {day.events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 rounded-lg bg-purple-50/80 px-3 py-2"
              >
                <span className="shrink-0 text-xs font-semibold text-purple-600 min-w-[4rem]">
                  {formatEventTime(event.start) || "시간 미정"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-purple-900">{event.title}</p>
                  {event.platform && (
                    <p className="text-xs text-purple-600">{event.platform}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {daysWithoutEvents.length > 0 && (
        <p className="pt-2 text-center text-xs text-purple-500/70">
          나머지 {daysWithoutEvents.length}일은 일정이 없습니다.
        </p>
      )}
    </div>
  );
}

function buildCalendarDays(month: Date, events: ScheduleEvent[]): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  // First day of the month
  const firstDay = new Date(year, monthIndex, 1);
  // Last day of the month
  const lastDay = new Date(year, monthIndex + 1, 0);

  // Start from the Sunday of the week containing the first day
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // End at the Saturday of the week containing the last day
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: CalendarDay[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const dateKey = formatDateKey(current);
    const dayEvents = events.filter((event) => {
      const eventDate = new Date(event.start);
      return formatDateKey(eventDate) === dateKey;
    });

    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === monthIndex,
      isToday: current.getTime() === today.getTime(),
      isWeekend: current.getDay() === 0 || current.getDay() === 6,
      events: dayEvents.sort((a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      ),
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEventTime(startISO: string): string {
  const date = new Date(startISO);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (date.getHours() === 0 && date.getMinutes() === 0) {
    return "시간 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isEventInMonth(event: ScheduleEvent, month: Date): boolean {
  const eventDate = new Date(event.start);
  return (
    eventDate.getFullYear() === month.getFullYear() &&
    eventDate.getMonth() === month.getMonth()
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-purple-700"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-purple-700"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-purple-700"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
