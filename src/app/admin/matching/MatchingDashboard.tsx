// Created: 2026-02-19 00:00:00
'use client'

import * as XLSX from 'xlsx'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

// =====================================================
// 상수
// =====================================================
const STAFF = ['영준', '준영', '광해', '세영', '현준', '성미', '민종']
const INTRO_COMPLETE_STATUS = ['소개 완료', '매크로 완료', '매크로 대기']
const SIDE_INTRO_VALUES: (string | number)[] = ['완', '역', '4', 4]
const TALK_INTRO_VALUES: (string | number)[] = ['완', '2', 2]
const MATCHING_SUCCESS_STATUS = 'N'
const UPSERT_BATCH_SIZE = 300

// =====================================================
// 타입
// =====================================================
interface StaffStat {
  side: number
  talk: number
  total: number
}

interface ChangeResult {
  value: number
  direction: 'up' | 'down' | 'none'
}

interface DbStats {
  intro: { minDate: string | null; maxDate: string | null; count: number }
  matching: { minDate: string | null; maxDate: string | null; count: number }
}

interface UploadStatus {
  state: 'idle' | 'parsing' | 'uploading' | 'done' | 'error'
  message: string
}

interface IntroRecord {
  record_date: string
  no_code: string
  manager: string | null
  staff: string | null
  raw_data: Record<string, any>
}

interface IntroManagerStat {
  manager: string
  total: number
  side: number
  talk: number
  ratio: number
}

// =====================================================
// 유틸리티 함수 (원본 로직 그대로)
// =====================================================

function inferYearFromMonths(months: number[]): Record<number, number> {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const uniqueMonths = Array.from(new Set(months)).sort((a, b) => a - b)
  const yearAssignments: Record<number, number> = {}

  uniqueMonths.forEach(month => {
    if (month > currentMonth + 1) {
      yearAssignments[month] = currentYear - 1
    } else if (month >= currentMonth - 2 && month <= currentMonth + 1) {
      yearAssignments[month] = currentYear
    } else if (month >= 9) {
      yearAssignments[month] = currentYear - 1
    } else {
      yearAssignments[month] = currentYear
    }
  })

  if (uniqueMonths.includes(12) && uniqueMonths.includes(1)) {
    yearAssignments[12] = currentYear - 1
    yearAssignments[1] = currentYear
  }

  const fallMonths = [9, 10, 11, 12].filter(m => uniqueMonths.includes(m))
  if (fallMonths.length >= 2) {
    fallMonths.forEach(m => { yearAssignments[m] = currentYear - 1 })
  }

  return yearAssignments
}

function formatExcelDate(dateVal: any): string | null {
  if (!dateVal) return null
  if (typeof dateVal === 'number') {
    const date = new Date((dateVal - 25569) * 86400 * 1000)
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(dateVal)
}

function getWeekNumber(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const firstDay = new Date(year, 0, 1)
  const daysSince = Math.floor((date.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24))
  const weekNumber = Math.ceil((daysSince + firstDay.getDay() + 1) / 7)
  return `${year}년 ${weekNumber}주차`
}

function getMonthKey(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
}

function passDateFilter(dateStr: string | null, dayTypeFilter: string): boolean {
  if (!dateStr) return true
  if (dayTypeFilter === 'all') return true
  const day = new Date(dateStr).getDay()
  if (dayTypeFilter === 'weekday') return day >= 1 && day <= 5
  if (dayTypeFilter === 'weekend') return day === 0 || day === 6
  return true
}

function calcChange(current: number, previous: number): ChangeResult {
  if (previous === 0) return { value: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'none' }
  const change = (current - previous) / previous * 100
  return { value: Math.abs(parseFloat(change.toFixed(1))), direction: change >= 0 ? 'up' : 'down' }
}

// =====================================================
// 핵심 조인 로직 (원본과 동일)
// =====================================================

function buildIntroIndex(introData: any[]): Record<string, any> {
  const introIndex: Record<string, any> = {}
  introData.forEach(row => {
    const no = row['NO']
    const dateStr = row['_date']
    if (!no || !dateStr) return
    const key = `${dateStr}_${no}`
    introIndex[key] = {
      manager: row['매니저'],
      staff: row['담당자'],
      sideIntro: SIDE_INTRO_VALUES.includes(row['한쪽']),
      talkIntro: TALK_INTRO_VALUES.includes(row['알림톡']),
      raw: row,
    }
  })
  return introIndex
}

function joinIntroMatching(introData: any[], matchingData: any[]) {
  const introIndex = buildIntroIndex(introData)
  const results: any[] = []
  let joinSuccess = 0
  let joinFail = 0

  matchingData.forEach(matchRow => {
    if (matchRow['처리상태'] !== MATCHING_SUCCESS_STATUS) return

    let introDate = matchRow['소개시점']
    if (!introDate) { joinFail++; return }
    if (typeof introDate === 'number') introDate = formatExcelDate(introDate)

    const noF = matchRow['no.']
    const noM = matchRow['no..1']
    const keyF = noF ? `${introDate}_F${noF}` : null
    const keyM = noM ? `${introDate}_M${noM}` : null

    let introRecord = null
    let usedKey = null

    if (keyF && introIndex[keyF]) {
      introRecord = introIndex[keyF]; usedKey = keyF
    } else if (keyM && introIndex[keyM]) {
      introRecord = introIndex[keyM]; usedKey = keyM
    }

    if (introRecord) {
      results.push({
        introRow: introRecord.raw, matchRow,
        staff: introRecord.staff || '담당자 미지정',
        manager: introRecord.manager,
        introDate, matchingDate: formatExcelDate(matchRow['날짜']),
        joinedKey: usedKey, joinStatus: 'success',
      })
      joinSuccess++
    } else {
      results.push({
        introRow: null, matchRow,
        staff: '찾을 수 없음', manager: null,
        introDate, matchingDate: formatExcelDate(matchRow['날짜']),
        joinedKey: null, joinStatus: 'fail',
      })
      joinFail++
    }
  })

  return { results, joinSuccess, joinFail, totalIndex: Object.keys(introIndex).length }
}

// =====================================================
// 전체 데이터 처리
// =====================================================

function processAllData(params: {
  introData: any[]
  matchingData: any[]
  startDate: string
  endDate: string
  selectedStaff: string
  aggregation: string
  dayTypeFilter: string
  currentDateBasis: string
}) {
  const { introData, matchingData, startDate, endDate, selectedStaff, aggregation, dayTypeFilter, currentDateBasis } = params
  const { results, joinSuccess, joinFail, totalIndex } = joinIntroMatching(introData, matchingData)

  const introStats: Record<string, StaffStat> = {}
  const dailyIntroStats: Record<string, { total: number }> = {}

  introData.forEach(row => {
    const staff = row['담당자']
    if (!staff) return
    const rowDate = row['_date']
    if (rowDate && (rowDate < startDate || rowDate > endDate)) return
    if (!passDateFilter(rowDate, dayTypeFilter)) return
    if (selectedStaff && staff !== selectedStaff) return

    if (!introStats[staff]) introStats[staff] = { side: 0, talk: 0, total: 0 }
    if (SIDE_INTRO_VALUES.includes(row['한쪽'])) introStats[staff].side++
    if (TALK_INTRO_VALUES.includes(row['알림톡'])) introStats[staff].talk++
    if (INTRO_COMPLETE_STATUS.includes(row['가능/불가'])) {
      introStats[staff].total++
      if (rowDate) {
        if (!dailyIntroStats[rowDate]) dailyIntroStats[rowDate] = { total: 0 }
        dailyIntroStats[rowDate].total++
      }
    }
  })

  const matchingStats: Record<string, StaffStat> = {}
  const dailyMatchingStats: Record<string, StaffStat> = {}

  results.forEach(result => {
    const staff = result.staff
    const dateForFilter = currentDateBasis === 'matching' ? result.matchingDate : result.introDate
    if (dateForFilter && (dateForFilter < startDate || dateForFilter > endDate)) return
    if (!passDateFilter(dateForFilter, dayTypeFilter)) return
    if (selectedStaff && staff !== selectedStaff) return

    if (!matchingStats[staff]) matchingStats[staff] = { side: 0, talk: 0, total: 0 }
    const isTalk = result.matchRow['알림톡'] === 'Y'
    if (isTalk) { matchingStats[staff].talk++ } else { matchingStats[staff].side++ }
    matchingStats[staff].total++

    if (dateForFilter) {
      if (!dailyMatchingStats[dateForFilter]) dailyMatchingStats[dateForFilter] = { side: 0, talk: 0, total: 0 }
      if (isTalk) { dailyMatchingStats[dateForFilter].talk++ } else { dailyMatchingStats[dateForFilter].side++ }
      dailyMatchingStats[dateForFilter].total++
    }
  })

  const totalIntro = Object.values(introStats).reduce((s, v) => s + v.total, 0)
  const totalMatching = Object.values(matchingStats).reduce((s, v) => s + v.total, 0)
  const matchingRate = totalIntro > 0 ? ((totalMatching / totalIntro) * 100).toFixed(1) : '0.0'
  const totalMatchingN = matchingData.filter(r => r['처리상태'] === 'N').length

  const start = new Date(startDate)
  const end = new Date(endDate)
  const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - periodDays + 1)
  const prevStartStr = prevStart.toISOString().slice(0, 10)
  const prevEndStr = prevEnd.toISOString().slice(0, 10)

  let prevIntroTotal = 0
  introData.forEach(row => {
    const rowDate = row['_date']
    if (!rowDate || rowDate < prevStartStr || rowDate > prevEndStr) return
    if (!passDateFilter(rowDate, dayTypeFilter)) return
    if (selectedStaff && row['담당자'] !== selectedStaff) return
    if (INTRO_COMPLETE_STATUS.includes(row['가능/불가'])) prevIntroTotal++
  })

  let prevMatchingTotal = 0
  results.forEach(result => {
    const dateForFilter = currentDateBasis === 'matching' ? result.matchingDate : result.introDate
    if (!dateForFilter || dateForFilter < prevStartStr || dateForFilter > prevEndStr) return
    if (!passDateFilter(dateForFilter, dayTypeFilter)) return
    if (selectedStaff && result.staff !== selectedStaff) return
    prevMatchingTotal++
  })

  const prevMatchingRate = prevIntroTotal > 0 ? (prevMatchingTotal / prevIntroTotal) * 100 : 0
  const periodLabel = aggregation === 'monthly' ? '전월' : aggregation === 'weekly' ? '전주' : '이전'

  const allDates = new Set([...Object.keys(dailyMatchingStats), ...Object.keys(dailyIntroStats)])
  const aggregated: Record<string, { intro: number; matching: number }> = {}
  allDates.forEach(date => {
    let key: string
    if (aggregation === 'daily') key = date
    else if (aggregation === 'weekly') key = getWeekNumber(date)
    else key = getMonthKey(date)
    if (!aggregated[key]) aggregated[key] = { intro: 0, matching: 0 }
    aggregated[key].intro += dailyIntroStats[date]?.total || 0
    aggregated[key].matching += dailyMatchingStats[date]?.total || 0
  })
  const sortedKeys = Object.keys(aggregated).sort()

  const allStaffSet = new Set([...Object.keys(matchingStats), ...Object.keys(introStats)])
  const staffList = Array.from(allStaffSet)
    .sort((a, b) => (introStats[b]?.total || 0) - (introStats[a]?.total || 0))
    .slice(0, 10)

  const tableStaff = Array.from(allStaffSet).sort((a, b) => (introStats[b]?.total || 0) - (introStats[a]?.total || 0))
  const rankingStaff = Object.keys(matchingStats)
    .filter(s => s !== '찾을 수 없음')
    .sort((a, b) => matchingStats[b].total - matchingStats[a].total)
    .slice(0, 3)

  return {
    introStats, matchingStats, dailyIntroStats, dailyMatchingStats,
    trendChart: {
      labels: sortedKeys,
      introValues: sortedKeys.map(k => aggregated[k].intro),
      matchingValues: sortedKeys.map(k => aggregated[k].matching),
    },
    staffChart: {
      labels: staffList,
      matchingValues: staffList.map(s => matchingStats[s]?.total || 0),
      introValues: staffList.map(s => introStats[s]?.total || 0),
    },
    tableStaff, rankingStaff,
    kpi: {
      totalIntro, totalMatching, matchingRate,
      joinSuccess, totalMatchingN,
      introChange: calcChange(totalIntro, prevIntroTotal),
      matchingChange: calcChange(totalMatching, prevMatchingTotal),
      rateChange: calcChange(parseFloat(matchingRate), prevMatchingRate),
      periodLabel,
    },
    debug: { totalIndex, joinSuccess, joinFail, totalMatchingN },
  }
}

// =====================================================
// 컴포넌트
// =====================================================

export default function MatchingDashboard() {
  const supabase = createClient()

  // 탭
  const [activeTab, setActiveTab] = useState<'manage' | 'analyze' | 'intro-status'>('manage')

  // DB 통계 (날짜 범위 + 건수)
  const [dbStats, setDbStats] = useState<DbStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  // 업로드 상태
  const [introUpload, setIntroUpload] = useState<UploadStatus>({ state: 'idle', message: '' })
  const [matchingUpload, setMatchingUpload] = useState<UploadStatus>({ state: 'idle', message: '' })

  // 드래그 상태
  const [introDragging, setIntroDragging] = useState(false)
  const [matchingDragging, setMatchingDragging] = useState(false)

  // 성과 분석 데이터 (DB에서 로드)
  const [introData, setIntroData] = useState<any[] | null>(null)
  const [matchingData, setMatchingData] = useState<any[] | null>(null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)

  // 분석 필터
  const [currentDateBasis, setCurrentDateBasis] = useState<'matching' | 'intro'>('matching')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [aggregation, setAggregation] = useState('daily')
  const [dayTypeFilter, setDayTypeFilter] = useState('all')

  // 소개 현황 탭 전용 상태
  const INTRO_PAGE_SIZE = 50
  const [introStatusData, setIntroStatusData] = useState<IntroRecord[] | null>(null)
  const [introPrevData, setIntroPrevData] = useState<IntroRecord[] | null>(null)
  const [introStatusLoading, setIntroStatusLoading] = useState(false)
  const [introStartDate, setIntroStartDate] = useState('')
  const [introEndDate, setIntroEndDate] = useState('')
  const [introManagerFilter, setIntroManagerFilter] = useState('')
  const [introPage, setIntroPage] = useState(1)
  const [introSortKey, setIntroSortKey] = useState<'total' | 'side' | 'talk' | 'ratio'>('total')
  const [introSortDir, setIntroSortDir] = useState<'asc' | 'desc'>('desc')

  // -------------------------------------------------------
  // DB 통계 불러오기
  // -------------------------------------------------------
  const fetchDbStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const [introMin, introMax, introCount, matchingMin, matchingMax, matchingCount] = await Promise.all([
        supabase.from('intro_records').select('record_date').order('record_date', { ascending: true }).limit(1),
        supabase.from('intro_records').select('record_date').order('record_date', { ascending: false }).limit(1),
        supabase.from('intro_records').select('*', { count: 'exact', head: true }),
        supabase.from('matching_records').select('matching_date').order('matching_date', { ascending: true }).limit(1),
        supabase.from('matching_records').select('matching_date').order('matching_date', { ascending: false }).limit(1),
        supabase.from('matching_records').select('*', { count: 'exact', head: true }),
      ])

      setDbStats({
        intro: {
          minDate: introMin.data?.[0]?.record_date ?? null,
          maxDate: introMax.data?.[0]?.record_date ?? null,
          count: introCount.count ?? 0,
        },
        matching: {
          minDate: matchingMin.data?.[0]?.matching_date ?? null,
          maxDate: matchingMax.data?.[0]?.matching_date ?? null,
          count: matchingCount.count ?? 0,
        },
      })
    } catch (err) {
      console.error('DB 통계 로드 실패', err)
    } finally {
      setIsLoadingStats(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchDbStats()
  }, [fetchDbStats])

  // -------------------------------------------------------
  // 소개 데이터 파일 → Supabase upsert
  // -------------------------------------------------------
  const processIntroFile = async (file: File) => {
    setIntroUpload({ state: 'parsing', message: '파일 파싱 중...' })
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })

      const sheetMonths: number[] = []
      workbook.SheetNames.forEach(sheetName => {
        const match = sheetName.match(/(\d{1,2})\.(\d{1,2})/)
        if (match) sheetMonths.push(parseInt(match[1]))
      })
      const yearAssignments = inferYearFromMonths(sheetMonths)

      let allRows: any[] = []
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName]
        const sheetData: any[] = XLSX.utils.sheet_to_json(sheet)
        const match = sheetName.match(/(\d{1,2})\.(\d{1,2})/)
        if (!match) return

        const month = parseInt(match[1])
        const day = parseInt(match[2])
        const year = yearAssignments[month] || new Date().getFullYear()
        const sheetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

        sheetData
          .filter(row => row.NO && String(row.NO).trim())
          .forEach(row => {
            allRows.push({
              record_date: sheetDate,
              no_code: String(row.NO),
              staff: row['담당자'] || null,
              manager: row['매니저'] || null,
              raw_data: { ...row, _date: sheetDate },
            })
          })
      })

      if (allRows.length === 0) {
        setIntroUpload({ state: 'error', message: '유효한 데이터가 없습니다.' })
        return
      }

      setIntroUpload({ state: 'uploading', message: `${allRows.length.toLocaleString()}건 업로드 중...` })

      let upsertedCount = 0
      for (let i = 0; i < allRows.length; i += UPSERT_BATCH_SIZE) {
        const batch = allRows.slice(i, i + UPSERT_BATCH_SIZE)
        const { error } = await supabase
          .from('intro_records')
          .upsert(batch, { onConflict: 'record_date,no_code' })
        if (error) throw error
        upsertedCount += batch.length
        setIntroUpload({
          state: 'uploading',
          message: `${upsertedCount.toLocaleString()} / ${allRows.length.toLocaleString()}건 업로드 중...`,
        })
      }

      setIntroUpload({ state: 'done', message: `완료: ${allRows.length.toLocaleString()}건 저장됨` })
      await fetchDbStats()
    } catch (err: any) {
      setIntroUpload({ state: 'error', message: '실패: ' + err.message })
    }
  }

  // -------------------------------------------------------
  // 매칭 데이터 파일 → Supabase upsert
  // -------------------------------------------------------
  const processMatchingFile = async (file: File) => {
    setMatchingUpload({ state: 'parsing', message: '파일 파싱 중...' })
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const parsed: any[] = XLSX.utils.sheet_to_json(firstSheet)

      const rowsRaw = parsed.map(row => {
        const introDateRaw = row['소개시점']
        const introDateStr = typeof introDateRaw === 'number'
          ? (formatExcelDate(introDateRaw) ?? '')
          : (introDateRaw ? String(introDateRaw) : '')

        const matchingDateStr = formatExcelDate(row['날짜'])

        return {
          matching_date: matchingDateStr || '1900-01-01',
          intro_date: introDateStr,
          no_f: row['no.'] ? String(row['no.']) : '',
          no_m: row['no..1'] ? String(row['no..1']) : '',
          process_status: row['처리상태'] ? String(row['처리상태']) : null,
          raw_data: row,
        }
      })

      // 파일 내 중복 제거 (intro_date+no_f+no_m+matching_date 기준, 마지막 행 우선)
      const dedupeMap = new Map<string, typeof rowsRaw[0]>()
      rowsRaw.forEach(r => {
        const key = `${r.intro_date}|${r.no_f}|${r.no_m}|${r.matching_date}`
        dedupeMap.set(key, r)
      })
      const rows = Array.from(dedupeMap.values())

      if (rows.length === 0) {
        setMatchingUpload({ state: 'error', message: '유효한 데이터가 없습니다.' })
        return
      }

      setMatchingUpload({ state: 'uploading', message: `${rows.length.toLocaleString()}건 업로드 중...` })

      let upsertedCount = 0
      for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
        const { error } = await supabase
          .from('matching_records')
          .upsert(batch, { onConflict: 'intro_date,no_f,no_m,matching_date' })
        if (error) throw error
        upsertedCount += batch.length
        setMatchingUpload({
          state: 'uploading',
          message: `${upsertedCount.toLocaleString()} / ${rows.length.toLocaleString()}건 업로드 중...`,
        })
      }

      setMatchingUpload({ state: 'done', message: `완료: ${rows.length.toLocaleString()}건 저장됨` })
      await fetchDbStats()
    } catch (err: any) {
      setMatchingUpload({ state: 'error', message: '실패: ' + err.message })
    }
  }

  // -------------------------------------------------------
  // DB에서 분석 데이터 로드
  // -------------------------------------------------------
  const handleLoadAnalysis = async () => {
    if (!startDate || !endDate) {
      alert('분석 시작일과 종료일을 입력해주세요.')
      return
    }

    // 이전 기간 비교를 위해 추가로 같은 기간만큼 이전 데이터도 로드
    const start = new Date(startDate)
    const end = new Date(endDate)
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - periodDays)
    const prevStartStr = prevStart.toISOString().slice(0, 10)

    setIsLoadingAnalysis(true)
    try {
      const [introRes, matchingRes] = await Promise.all([
        supabase
          .from('intro_records')
          .select('record_date, raw_data')
          .gte('record_date', prevStartStr)
          .lte('record_date', endDate),
        supabase
          .from('matching_records')
          .select('raw_data')
          .gte('matching_date', prevStartStr)
          .lte('matching_date', endDate),
      ])

      if (introRes.error) throw introRes.error
      if (matchingRes.error) throw matchingRes.error

      setIntroData((introRes.data || []).map((r: any) => ({ ...r.raw_data, _date: r.record_date })))
      setMatchingData((matchingRes.data || []).map((r: any) => r.raw_data))
    } catch (err: any) {
      alert('데이터 로드 실패: ' + err.message)
    } finally {
      setIsLoadingAnalysis(false)
    }
  }

  // -------------------------------------------------------
  // 소개 현황 데이터 로드
  // -------------------------------------------------------
  const handleLoadIntroStatus = async () => {
    if (!introStartDate || !introEndDate) {
      alert('시작일과 종료일을 입력해주세요.')
      return
    }

    const start = new Date(introStartDate)
    const end = new Date(introEndDate)
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevEnd = new Date(start)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - periodDays + 1)
    const prevStartStr = prevStart.toISOString().slice(0, 10)
    const prevEndStr = prevEnd.toISOString().slice(0, 10)

    setIntroStatusLoading(true)
    try {
      const [currRes, prevRes] = await Promise.all([
        supabase
          .from('intro_records')
          .select('record_date, no_code, manager, staff, raw_data')
          .gte('record_date', introStartDate)
          .lte('record_date', introEndDate)
          .order('record_date', { ascending: false }),
        supabase
          .from('intro_records')
          .select('record_date, no_code, manager, staff, raw_data')
          .gte('record_date', prevStartStr)
          .lte('record_date', prevEndStr)
          .order('record_date', { ascending: false }),
      ])

      if (currRes.error) throw currRes.error
      if (prevRes.error) throw prevRes.error

      setIntroStatusData(currRes.data as IntroRecord[])
      setIntroPrevData(prevRes.data as IntroRecord[])
      setIntroPage(1)
    } catch (err: any) {
      alert('데이터 로드 실패: ' + err.message)
    } finally {
      setIntroStatusLoading(false)
    }
  }

  // -------------------------------------------------------
  // 엑셀 내보내기
  // -------------------------------------------------------
  const handleExportToExcel = () => {
    if (!processedData) { alert('먼저 분석 데이터를 불러와주세요.'); return }

    const { introStats, matchingStats, dailyIntroStats, dailyMatchingStats, rankingStaff } = processedData
    const wb = XLSX.utils.book_new()

    const medals = ['🥇', '🥈', '🥉']
    const summaryData: any[][] = [
      ['매칭 성과 분석 리포트'], [],
      ['기간', `${startDate} ~ ${endDate}`],
      ['집계 단위', aggregation], ['요일 필터', dayTypeFilter], [],
      ['총 소개 수', Object.values(introStats).reduce((s, v) => s + v.total, 0)],
      ['총 매칭 수', Object.values(matchingStats).reduce((s, v) => s + v.total, 0)],
      [], ['담당자 랭킹 Top 3'],
    ]
    rankingStaff.forEach((staff, idx) => {
      const mStat = matchingStats[staff]
      const iStat = introStats[staff] || { total: 0 }
      const rate = iStat.total > 0 ? ((mStat.total / iStat.total) * 100).toFixed(1) : 0
      summaryData.push([`${medals[idx]} ${staff}`, `매칭 ${mStat.total}건`, `소개 ${iStat.total}건`, `${rate}%`])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '요약')

    const staffData: any[][] = [['담당자', '한쪽 소개', '알림톡 소개', '총 소개', '한쪽 매칭', '알림톡 매칭', '총 매칭', '매칭률(%)']]
    const allStaff = new Set([...Object.keys(matchingStats), ...Object.keys(introStats)])
    Array.from(allStaff).sort((a, b) => (introStats[b]?.total || 0) - (introStats[a]?.total || 0)).forEach(staff => {
      const mStat = matchingStats[staff] || { side: 0, talk: 0, total: 0 }
      const iStat = introStats[staff] || { side: 0, talk: 0, total: 0 }
      const rate = iStat.total > 0 ? ((mStat.total / iStat.total) * 100).toFixed(1) : 0
      staffData.push([staff, iStat.side, iStat.talk, iStat.total, mStat.side, mStat.talk, mStat.total, rate])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(staffData), '담당자별 상세')

    const trendData: any[][] = [['날짜', '소개 수', '매칭 수', '매칭률(%)']]
    const allDatesSet = new Set([...Object.keys(dailyIntroStats), ...Object.keys(dailyMatchingStats)])
    Array.from(allDatesSet).sort().forEach(date => {
      const intro = dailyIntroStats[date]?.total || 0
      const matching = dailyMatchingStats[date]?.total || 0
      const rate = intro > 0 ? ((matching / intro) * 100).toFixed(1) : 0
      trendData.push([date, intro, matching, rate])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(trendData), '일별 트렌드')

    XLSX.writeFile(wb, `매칭분석_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // -------------------------------------------------------
  // 분석 결과
  // -------------------------------------------------------
  const processedData = useMemo(() => {
    if (!introData || !matchingData || !startDate || !endDate) return null
    return processAllData({
      introData, matchingData, startDate, endDate,
      selectedStaff, aggregation, dayTypeFilter, currentDateBasis,
    })
  }, [introData, matchingData, startDate, endDate, selectedStaff, aggregation, dayTypeFilter, currentDateBasis])

  const computedIntroStats = useMemo(() => {
    if (!introStatusData) return null

    const filtered = introManagerFilter
      ? introStatusData.filter(r => r.manager === introManagerFilter)
      : introStatusData

    let totalCount = 0
    let sideCount = 0
    let talkCount = 0
    filtered.forEach(r => {
      totalCount++
      if (SIDE_INTRO_VALUES.includes(r.raw_data?.['한쪽'])) sideCount++
      if (TALK_INTRO_VALUES.includes(r.raw_data?.['알림톡'])) talkCount++
    })

    let prevTotal = 0
    let prevSide = 0
    let prevTalk = 0
    if (introPrevData) {
      const prevFiltered = introManagerFilter
        ? introPrevData.filter(r => r.manager === introManagerFilter)
        : introPrevData
      prevFiltered.forEach(r => {
        prevTotal++
        if (SIDE_INTRO_VALUES.includes(r.raw_data?.['한쪽'])) prevSide++
        if (TALK_INTRO_VALUES.includes(r.raw_data?.['알림톡'])) prevTalk++
      })
    }

    const managerMap: Record<string, { total: number; side: number; talk: number }> = {}
    introStatusData.forEach(r => {
      const mgr = r.manager || '미지정'
      if (!managerMap[mgr]) managerMap[mgr] = { total: 0, side: 0, talk: 0 }
      managerMap[mgr].total++
      if (SIDE_INTRO_VALUES.includes(r.raw_data?.['한쪽'])) managerMap[mgr].side++
      if (TALK_INTRO_VALUES.includes(r.raw_data?.['알림톡'])) managerMap[mgr].talk++
    })

    const managerStats: IntroManagerStat[] = Object.entries(managerMap).map(([manager, stat]) => ({
      manager,
      ...stat,
      ratio: introStatusData.length > 0 ? (stat.total / introStatusData.length) * 100 : 0,
    }))

    managerStats.sort((a, b) => {
      const diff = a[introSortKey] - b[introSortKey]
      return introSortDir === 'desc' ? -diff : diff
    })

    const managers = Array.from(new Set(introStatusData.map(r => r.manager).filter(Boolean))) as string[]

    const totalPages = Math.ceil(filtered.length / INTRO_PAGE_SIZE)
    const pageData = filtered.slice((introPage - 1) * INTRO_PAGE_SIZE, introPage * INTRO_PAGE_SIZE)

    return {
      totalCount, sideCount, talkCount,
      prevTotal, prevSide, prevTalk,
      totalChange: calcChange(totalCount, prevTotal),
      sideChange: calcChange(sideCount, prevSide),
      talkChange: calcChange(talkCount, prevTalk),
      managerStats, managers, filtered, pageData, totalPages,
    }
  }, [introStatusData, introPrevData, introManagerFilter, introPage, introSortKey, introSortDir])

  const changeIcon = (c: ChangeResult) => {
    if (c.direction === 'none') return null
    return c.direction === 'up'
      ? <span className="text-green-300">▲ {c.value}%</span>
      : <span className="text-red-300">▼ {c.value}%</span>
  }

  // =====================================================
  // 렌더링
  // =====================================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <span className="hover:text-primary-600 cursor-pointer" onClick={() => window.location.href = '/admin'}>대시보드</span>
          <span>/</span>
          <span>소개성과측정</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">소개 성과 측정</h1>
            <p className="mt-1 text-sm text-gray-500">팅팅팅 소개팅 앱 · 매칭 성과 분석</p>
          </div>
          {processedData && (
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              엑셀 다운로드
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 mb-6">
        {[
          { key: 'manage', label: '📦 데이터 관리' },
          { key: 'analyze', label: '📊 성과 분석' },
          { key: 'intro-status', label: '📋 소개 현황' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'manage' | 'analyze' | 'intro-status')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== 데이터 관리 탭 ==================== */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* DB 현황 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 소개 데이터 현황 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">소개 데이터</h2>
                {isLoadingStats ? (
                  <span className="text-xs text-gray-400">로딩 중...</span>
                ) : dbStats?.intro.count ? (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    {dbStats.intro.count.toLocaleString()}건 저장됨
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">데이터 없음</span>
                )}
              </div>

              {/* 날짜 범위 */}
              {dbStats?.intro.minDate && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-violet-50 rounded-lg">
                  <span className="text-lg">📅</span>
                  <div className="text-sm text-violet-800">
                    <span className="font-semibold">{dbStats.intro.minDate}</span>
                    <span className="mx-2 text-violet-400">~</span>
                    <span className="font-semibold">{dbStats.intro.maxDate}</span>
                    <span className="text-xs text-violet-500 ml-1">까지 저장됨</span>
                  </div>
                </div>
              )}

              {/* 업로드 상태 */}
              {introUpload.state !== 'idle' && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${
                  introUpload.state === 'done'
                    ? 'bg-green-50 text-green-700'
                    : introUpload.state === 'error'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-blue-50 text-blue-700'
                }`}>
                  {introUpload.state === 'uploading' || introUpload.state === 'parsing'
                    ? <span className="animate-pulse">⏳ {introUpload.message}</span>
                    : introUpload.state === 'done'
                      ? <span>✅ {introUpload.message}</span>
                      : <span>❌ {introUpload.message}</span>
                  }
                </div>
              )}

              {/* 업로드 영역 */}
              <label
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  introUpload.state === 'uploading' || introUpload.state === 'parsing'
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : introDragging
                      ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                      : 'border-primary-300 bg-white hover:border-primary-500 hover:bg-primary-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIntroDragging(true) }}
                onDragEnter={(e) => { e.preventDefault(); setIntroDragging(true) }}
                onDragLeave={() => setIntroDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIntroDragging(false)
                  const file = e.dataTransfer.files[0]
                  if (file) processIntroFile(file)
                }}
              >
                <input
                  type="file" accept=".xlsx,.xls" className="hidden"
                  disabled={introUpload.state === 'uploading' || introUpload.state === 'parsing'}
                  onChange={e => { const f = e.target.files?.[0]; if (f) processIntroFile(f) }}
                />
                <div className="text-3xl mb-2">{introDragging ? '📂' : '📤'}</div>
                {introDragging ? (
                  <p className="font-semibold text-violet-600 text-sm">여기에 놓으세요</p>
                ) : (
                  <>
                    <p className="font-semibold text-gray-700 text-sm">임시_데이터.xlsx 추가 업로드</p>
                    <p className="text-xs text-gray-400 mt-1">클릭 또는 드래그&드롭 · 중복 자동 무시</p>
                  </>
                )}
              </label>
            </div>

            {/* 매칭 데이터 현황 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">매칭 데이터</h2>
                {isLoadingStats ? (
                  <span className="text-xs text-gray-400">로딩 중...</span>
                ) : dbStats?.matching.count ? (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                    {dbStats.matching.count.toLocaleString()}건 저장됨
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">데이터 없음</span>
                )}
              </div>

              {dbStats?.matching.minDate && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-violet-50 rounded-lg">
                  <span className="text-lg">📅</span>
                  <div className="text-sm text-violet-800">
                    <span className="font-semibold">{dbStats.matching.minDate}</span>
                    <span className="mx-2 text-violet-400">~</span>
                    <span className="font-semibold">{dbStats.matching.maxDate}</span>
                    <span className="text-xs text-violet-500 ml-1">까지 저장됨</span>
                  </div>
                </div>
              )}

              {matchingUpload.state !== 'idle' && (
                <div className={`mb-3 px-3 py-2 rounded-lg text-sm ${
                  matchingUpload.state === 'done'
                    ? 'bg-green-50 text-green-700'
                    : matchingUpload.state === 'error'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-blue-50 text-blue-700'
                }`}>
                  {matchingUpload.state === 'uploading' || matchingUpload.state === 'parsing'
                    ? <span className="animate-pulse">⏳ {matchingUpload.message}</span>
                    : matchingUpload.state === 'done'
                      ? <span>✅ {matchingUpload.message}</span>
                      : <span>❌ {matchingUpload.message}</span>
                  }
                </div>
              )}

              <label
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  matchingUpload.state === 'uploading' || matchingUpload.state === 'parsing'
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                    : matchingDragging
                      ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                      : 'border-primary-300 bg-white hover:border-primary-500 hover:bg-primary-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setMatchingDragging(true) }}
                onDragEnter={(e) => { e.preventDefault(); setMatchingDragging(true) }}
                onDragLeave={() => setMatchingDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setMatchingDragging(false)
                  const file = e.dataTransfer.files[0]
                  if (file) processMatchingFile(file)
                }}
              >
                <input
                  type="file" accept=".xlsx,.xls" className="hidden"
                  disabled={matchingUpload.state === 'uploading' || matchingUpload.state === 'parsing'}
                  onChange={e => { const f = e.target.files?.[0]; if (f) processMatchingFile(f) }}
                />
                <div className="text-3xl mb-2">{matchingDragging ? '📂' : '📤'}</div>
                {matchingDragging ? (
                  <p className="font-semibold text-violet-600 text-sm">여기에 놓으세요</p>
                ) : (
                  <>
                    <p className="font-semibold text-gray-700 text-sm">매칭성공.xlsx 추가 업로드</p>
                    <p className="text-xs text-gray-400 mt-1">클릭 또는 드래그&드롭 · 중복 자동 무시</p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">📌 사용 방법</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>처음에는 전체 기간 파일을 업로드하세요. 이후에는 새 기간 파일만 추가하면 됩니다.</li>
              <li>같은 날짜·번호의 데이터를 다시 올려도 중복 저장되지 않습니다.</li>
              <li>업로드 후 &quot;성과 분석&quot; 탭에서 날짜 범위를 설정하고 분석을 시작하세요.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ==================== 성과 분석 탭 ==================== */}
      {activeTab === 'analyze' && (
        <div className="space-y-6">
          {/* 데이터 로드 섹션 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">분석 기간 설정 및 데이터 불러오기</h2>

            {/* DB 저장 현황 요약 */}
            {dbStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-3 px-3 py-2 bg-violet-50 rounded-lg text-sm">
                  <span>📄</span>
                  <div>
                    <span className="text-gray-500">소개 데이터 저장 범위: </span>
                    {dbStats.intro.minDate ? (
                      <span className="font-semibold text-violet-700">
                        {dbStats.intro.minDate} ~ {dbStats.intro.maxDate}
                      </span>
                    ) : (
                      <span className="text-gray-400">데이터 없음</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-2 bg-violet-50 rounded-lg text-sm">
                  <span>🔗</span>
                  <div>
                    <span className="text-gray-500">매칭 데이터 저장 범위: </span>
                    {dbStats.matching.minDate ? (
                      <span className="font-semibold text-violet-700">
                        {dbStats.matching.minDate} ~ {dbStats.matching.maxDate}
                      </span>
                    ) : (
                      <span className="text-gray-400">데이터 없음</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">시작 날짜</label>
                <input
                  type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료 날짜</label>
                <input
                  type="date" value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              <button
                onClick={handleLoadAnalysis}
                disabled={isLoadingAnalysis || !startDate || !endDate}
                className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingAnalysis ? '불러오는 중...' : '데이터 불러오기'}
              </button>
              {introData && matchingData && (
                <span className="text-xs text-green-600 font-medium">
                  ✅ 소개 {introData.length.toLocaleString()}건 · 매칭 {matchingData.length.toLocaleString()}건 로드됨
                </span>
              )}
            </div>
          </div>

          {/* 안내 메시지 */}
          {!introData && !matchingData && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-500 mb-2">분석 기간을 설정하고 <strong>데이터 불러오기</strong>를 클릭하세요.</p>
              {(!dbStats?.intro.count || !dbStats?.matching.count) && (
                <p className="text-sm text-amber-600 mt-2">
                  먼저 <button className="underline" onClick={() => setActiveTab('manage')}>데이터 관리</button> 탭에서 데이터를 업로드해주세요.
                </p>
              )}
            </div>
          )}

          {/* 분석 필터 (데이터 로드 후) */}
          {introData && matchingData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">기준 날짜</label>
                  <button
                    onClick={() => setCurrentDateBasis(b => b === 'matching' ? 'intro' : 'matching')}
                    className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentDateBasis === 'matching' ? 'bg-primary-600 text-white' : 'bg-green-600 text-white'
                    }`}
                  >
                    {currentDateBasis === 'matching' ? '매칭 날짜 기준' : '소개 날짜 기준'}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">담당자</label>
                  <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                    <option value="">전체</option>
                    {STAFF.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="찾을 수 없음">찾을 수 없음</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">집계 단위</label>
                  <select value={aggregation} onChange={e => setAggregation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                    <option value="daily">일별</option>
                    <option value="weekly">주별</option>
                    <option value="monthly">월별</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">요일 필터</label>
                  <select value={dayTypeFilter} onChange={e => setDayTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
                    <option value="all">전체</option>
                    <option value="weekday">평일만</option>
                    <option value="weekend">주말만</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 대시보드 */}
          {processedData && (
            <div className="space-y-6">
              {/* KPI 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: '총 소개 수', value: processedData.kpi.totalIntro.toLocaleString(), change: processedData.kpi.introChange, suffix: processedData.kpi.periodLabel + ' 대비' },
                  { label: '총 매칭 수', value: processedData.kpi.totalMatching.toLocaleString(), change: processedData.kpi.matchingChange, suffix: processedData.kpi.periodLabel + ' 대비' },
                  { label: '매칭률', value: processedData.kpi.matchingRate + '%', change: processedData.kpi.rateChange, suffix: processedData.kpi.periodLabel + ' 대비' },
                  { label: '조인 성공', value: processedData.kpi.joinSuccess.toLocaleString(), change: null, suffix: `전체 ${processedData.kpi.totalMatchingN}건 중` },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-xl p-5 shadow-md">
                    <p className="text-sm opacity-90 mb-2">{kpi.label}</p>
                    <p className="text-3xl font-bold mb-1">{kpi.value}</p>
                    <p className="text-xs opacity-80">
                      {kpi.change && kpi.change.direction !== 'none' ? (
                        <>{changeIcon(kpi.change)} {kpi.suffix}</>
                      ) : kpi.suffix}
                    </p>
                  </div>
                ))}
              </div>

              {/* 담당자 랭킹 Top 3 */}
              {processedData.rankingStaff.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">🏆 담당자 랭킹 Top 3</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {processedData.rankingStaff.map((staff, idx) => {
                      const mStat = processedData.matchingStats[staff]
                      const iStat = processedData.introStats[staff] || { total: 0 }
                      const rate = iStat.total > 0 ? ((mStat.total / iStat.total) * 100).toFixed(1) : 0
                      const medals = ['🥇', '🥈', '🥉']
                      const borders = [
                        'border-yellow-400 bg-gradient-to-br from-yellow-50 to-yellow-100',
                        'border-gray-400 bg-gradient-to-br from-gray-50 to-gray-100',
                        'border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100',
                      ]
                      return (
                        <div key={staff} className={`rounded-xl border-2 p-5 text-center ${borders[idx]}`}>
                          <div className="text-4xl mb-2">{medals[idx]}</div>
                          <div className="text-xl font-bold text-gray-800 mb-1">{staff}</div>
                          <div className="text-sm text-gray-600">
                            매칭 <span className="font-semibold text-violet-600">{mStat.total}건</span>
                            <br />소개 {iStat.total}건 · 매칭률 {rate}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 트렌드 차트 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">📈 트렌드 차트</h2>
                <div style={{ height: 350 }}>
                  <Line
                    data={{
                      labels: processedData.trendChart.labels,
                      datasets: [
                        { label: '소개', data: processedData.trendChart.introValues, borderColor: '#f093fb', backgroundColor: 'rgba(240,147,251,0.1)', tension: 0.4, fill: true, borderDash: [5, 5] },
                        { label: '매칭', data: processedData.trendChart.matchingValues, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)', tension: 0.4, fill: true, borderWidth: 2 },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }}
                  />
                </div>
              </div>

              {/* 담당자별 성과 차트 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 담당자별 성과</h2>
                <div style={{ height: 350 }}>
                  <Bar
                    data={{
                      labels: processedData.staffChart.labels,
                      datasets: [
                        { label: '매칭', data: processedData.staffChart.matchingValues, backgroundColor: 'rgba(124,58,237,0.8)' },
                        { label: '소개', data: processedData.staffChart.introValues, backgroundColor: 'rgba(167,139,250,0.5)' },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }}
                  />
                </div>
              </div>

              {/* 담당자별 상세 테이블 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">📋 담당자별 상세 통계</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-violet-500 to-purple-700 text-white">
                      <tr>
                        {['담당자', '한쪽 소개', '알림톡 소개', '총 소개', '한쪽 매칭', '알림톡 매칭', '총 매칭', '매칭률'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-sm font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {processedData.tableStaff.map(staff => {
                        const mStat = processedData.matchingStats[staff] || { side: 0, talk: 0, total: 0 }
                        const iStat = processedData.introStats[staff] || { side: 0, talk: 0, total: 0 }
                        const rate = iStat.total > 0 ? ((mStat.total / iStat.total) * 100).toFixed(1) : '0.0'
                        const rateNum = parseFloat(rate)
                        const badgeColor = rateNum >= 30 ? 'bg-green-100 text-green-700' : rateNum >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                        return (
                          <tr key={staff} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-gray-900">{staff}</td>
                            <td className="px-4 py-3 text-gray-600">{iStat.side}</td>
                            <td className="px-4 py-3 text-gray-600">{iStat.talk}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{iStat.total}</td>
                            <td className="px-4 py-3 text-gray-600">{mStat.side}</td>
                            <td className="px-4 py-3 text-gray-600">{mStat.talk}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{mStat.total}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>{rate}%</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 디버그 */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 font-mono">
                <span className="font-semibold text-gray-600">🔍 조인 디버그 정보</span>
                <span className="ml-4">
                  소개 인덱스: {processedData.debug.totalIndex.toLocaleString()}건 |{' '}
                  매칭(N): {processedData.debug.totalMatchingN.toLocaleString()}건 |{' '}
                  조인 성공: {processedData.debug.joinSuccess.toLocaleString()}건 |{' '}
                  조인 실패: {processedData.debug.joinFail.toLocaleString()}건 |{' '}
                  성공률: {processedData.debug.totalMatchingN > 0
                    ? ((processedData.debug.joinSuccess / processedData.debug.totalMatchingN) * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 소개 현황 탭 ==================== */}
      {activeTab === 'intro-status' && (
        <div className="space-y-6">
          {/* 필터 패널 */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">조회 기간 설정</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">시작 날짜</label>
                <input
                  type="date" value={introStartDate}
                  onChange={e => setIntroStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">종료 날짜</label>
                <input
                  type="date" value={introEndDate}
                  onChange={e => setIntroEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>
              {computedIntroStats && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">매니저 필터</label>
                  <select
                    value={introManagerFilter}
                    onChange={e => { setIntroManagerFilter(e.target.value); setIntroPage(1) }}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">전체</option>
                    {computedIntroStats.managers.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={handleLoadIntroStatus}
                disabled={introStatusLoading || !introStartDate || !introEndDate}
                className="px-5 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {introStatusLoading ? '불러오는 중...' : '데이터 불러오기'}
              </button>
              {introStatusData && (
                <span className="text-xs text-green-600 font-medium">
                  ✅ {introStatusData.length.toLocaleString()}건 로드됨
                </span>
              )}
            </div>
          </div>

          {/* 안내 메시지 */}
          {!introStatusData && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-gray-500">날짜 범위를 설정하고 <strong>데이터 불러오기</strong>를 클릭하세요.</p>
            </div>
          )}

          {/* 대시보드 */}
          {computedIntroStats && (
            <div className="space-y-6">
              {/* KPI 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: '총 소개 건수',
                    value: computedIntroStats.totalCount.toLocaleString(),
                    change: computedIntroStats.totalChange,
                  },
                  {
                    label: '한쪽 소개 건수',
                    value: computedIntroStats.sideCount.toLocaleString(),
                    change: computedIntroStats.sideChange,
                  },
                  {
                    label: '알림톡 소개 건수',
                    value: computedIntroStats.talkCount.toLocaleString(),
                    change: computedIntroStats.talkChange,
                  },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-gradient-to-br from-violet-500 to-purple-700 text-white rounded-xl p-5 shadow-md">
                    <p className="text-sm opacity-90 mb-2">{kpi.label}</p>
                    <p className="text-3xl font-bold mb-1">{kpi.value}</p>
                    <p className="text-xs opacity-80">
                      {kpi.change.direction !== 'none' ? (
                        <>
                          {kpi.change.direction === 'up'
                            ? <span className="text-green-300">▲ {kpi.change.value}%</span>
                            : <span className="text-red-300">▼ {kpi.change.value}%</span>
                          }{' '}이전 기간 대비
                        </>
                      ) : '이전 기간 대비'}
                    </p>
                  </div>
                ))}
              </div>

              {/* 매니저별 통계 테이블 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-900">👤 매니저별 소개 통계</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-violet-500 to-purple-700 text-white">
                      <tr>
                        {[
                          { key: null, label: '매니저' },
                          { key: 'total' as const, label: '소개 건수' },
                          { key: 'side' as const, label: '한쪽' },
                          { key: 'talk' as const, label: '알림톡' },
                          { key: 'ratio' as const, label: '비율(%)' },
                        ].map(col => (
                          <th
                            key={col.label}
                            className={`px-4 py-3 text-left text-sm font-semibold ${col.key ? 'cursor-pointer hover:bg-white/10 select-none' : ''}`}
                            onClick={() => {
                              if (!col.key) return
                              if (introSortKey === col.key) {
                                setIntroSortDir(d => d === 'desc' ? 'asc' : 'desc')
                              } else {
                                setIntroSortKey(col.key)
                                setIntroSortDir('desc')
                              }
                            }}
                          >
                            {col.label}
                            {col.key && introSortKey === col.key && (
                              <span className="ml-1">{introSortDir === 'desc' ? '▼' : '▲'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {computedIntroStats.managerStats.map(stat => (
                        <tr key={stat.manager} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{stat.manager}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{stat.total.toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-600">{stat.side.toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-600">{stat.talk.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                              {stat.ratio.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 데이터 상세 테이블 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">
                    📄 상세 데이터
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({computedIntroStats.filtered.length.toLocaleString()}건)
                    </span>
                  </h2>
                  <span className="text-xs text-gray-400">
                    {introPage} / {computedIntroStats.totalPages} 페이지
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['날짜', 'NO', '매니저', '담당자', '상태', '등급', '한쪽', '알림톡'].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {computedIntroStats.pageData.map((row, idx) => (
                        <tr key={`${row.record_date}-${row.no_code}-${idx}`} className="hover:bg-gray-50 text-sm">
                          <td className="px-4 py-2 text-gray-700">{row.record_date}</td>
                          <td className="px-4 py-2 text-gray-600 font-mono text-xs">{row.no_code}</td>
                          <td className="px-4 py-2 text-gray-700">{row.manager || '-'}</td>
                          <td className="px-4 py-2 text-gray-700">{row.staff || '-'}</td>
                          <td className="px-4 py-2 text-gray-600">{row.raw_data?.['상태'] ?? '-'}</td>
                          <td className="px-4 py-2 text-gray-600">{row.raw_data?.['등급'] ?? '-'}</td>
                          <td className="px-4 py-2">
                            {SIDE_INTRO_VALUES.includes(row.raw_data?.['한쪽'])
                              ? <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{String(row.raw_data?.['한쪽'] ?? '')}</span>
                              : <span className="text-gray-400">{String(row.raw_data?.['한쪽'] ?? '-')}</span>
                            }
                          </td>
                          <td className="px-4 py-2">
                            {TALK_INTRO_VALUES.includes(row.raw_data?.['알림톡'])
                              ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">{String(row.raw_data?.['알림톡'] ?? '')}</span>
                              : <span className="text-gray-400">{String(row.raw_data?.['알림톡'] ?? '-')}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 페이지네이션 */}
                {computedIntroStats.totalPages > 1 && (
                  <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
                    <button
                      onClick={() => setIntroPage(p => Math.max(1, p - 1))}
                      disabled={introPage === 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      이전
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(7, computedIntroStats.totalPages) }, (_, i) => {
                        let page: number
                        const total = computedIntroStats.totalPages
                        if (total <= 7) {
                          page = i + 1
                        } else if (introPage <= 4) {
                          page = i + 1
                        } else if (introPage >= total - 3) {
                          page = total - 6 + i
                        } else {
                          page = introPage - 3 + i
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setIntroPage(page)}
                            className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                              introPage === page
                                ? 'bg-violet-600 text-white font-semibold'
                                : 'hover:bg-gray-100 text-gray-600'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      onClick={() => setIntroPage(p => Math.min(computedIntroStats.totalPages, p + 1))}
                      disabled={introPage === computedIntroStats.totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                    >
                      다음
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
